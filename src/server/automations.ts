import "server-only";
import { randomBytes } from "node:crypto";
import { withSystem, withTenant, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueueEmail, processOutbox } from "@/lib/email/outbox";
import { rateLimit } from "@/lib/ratelimit";
import {
  AUTOMATION_DEFAULTS, AUTOMATION_KEYS, DEFAULT_TEMPLATES, renderTemplate,
  type AutomationConfig, type AutomationKey, type TemplateKey,
} from "@/lib/company-defaults";
import { formatCents } from "@/lib/money";
import { addDaysIso, fmtDate, fmtDateLong, fmtTime, madridLocalToDate, madridParts, todayMadrid } from "@/lib/dates";
import { padFolio } from "@/lib/brand";
import { TIMEFRAMES, type QuoteStatus } from "@/lib/stages";
import { changeStage, logActivity } from "./contacts";

export interface RunReport {
  companies: number;
  actions: Record<AutomationKey, number>;
  errors: string[];
  outbox: Awaited<ReturnType<typeof processOutbox>>;
}

// ---------------------------------------------------------------------------
// Utilidades comunes
// ---------------------------------------------------------------------------

/** Configuración efectiva: la guardada por la empresa o, si no hay fila, la de serie. */
export async function getAutomation(tx: Tx, key: AutomationKey): Promise<{ enabled: boolean; config: AutomationConfig }> {
  const row = await tx.one<{ enabled: boolean; config: AutomationConfig }>(`select enabled, config from automations where key = $1`, [key]);
  const d = AUTOMATION_DEFAULTS[key];
  return { enabled: row ? row.enabled : d.enabledByDefault, config: { ...d.config, ...(row?.config ?? {}) } };
}

/** Plantilla de la empresa o, si aún no la ha personalizado, la de serie. */
export async function getTemplate(tx: Tx, key: TemplateKey): Promise<{ subject: string; body: string }> {
  return (await tx.one<{ subject: string; body: string }>(`select subject, body from email_templates where key = $1`, [key])) ?? DEFAULT_TEMPLATES[key];
}

async function companyVars(tx: Tx) {
  const c = await tx.one<{ name: string; phone: string | null; email: string | null }>(`select name, phone, email from companies where id = app_company_id()`);
  return { empresa: c?.name ?? "", telefono_empresa: c?.phone ?? "", email_empresa: c?.email ?? "" };
}

/**
 * Reserva la clave de deduplicación. Devuelve false si ya se ejecutó.
 * La reserva vive en la misma transacción que la acción: si la acción falla,
 * se deshace y se reintentará en la siguiente ejecución.
 */
async function claim(tx: Tx, key: AutomationKey, dedupe: string, detail: string) {
  const r = await tx.one<{ id: string }>(
    `insert into automation_runs(company_id, automation_key, dedupe_key, status, detail) values (app_company_id(), $1, $2, 'ok', $3)
     on conflict (company_id, automation_key, dedupe_key) do nothing returning id`, [key, dedupe, detail.slice(0, 500)]);
  return !!r;
}

async function recordError(companyId: string, key: AutomationKey, dedupe: string, err: unknown) {
  // Registro del error fuera de la transacción fallida. Se usa una clave distinta
  // para no bloquear el reintento de la acción real.
  const msg = err instanceof Error ? err.message : String(err);
  await withTenant({ companyId, userId: null }, (tx) =>
    tx.query(
      `insert into automation_runs(company_id, automation_key, dedupe_key, status, detail) values (app_company_id(), $1, $2, 'error', $3)
       on conflict (company_id, automation_key, dedupe_key) do update set detail = excluded.detail, created_at = now()`,
      [key, `error:${dedupe}`, msg.slice(0, 500)]),
  ).catch(() => {});
  return msg;
}

async function companyOwnerEmails(tx: Tx): Promise<string[]> {
  return (await tx.query<{ email: string }>(`select email from users where active and role in ('propietario','administrador') order by role, created_at`)).map((r) => r.email);
}

function link(path: string) {
  return `${env.appUrl}${path}`;
}

export function publicQuoteUrl(token: string) {
  return link(`/p/${token}`);
}

/** Token público del presupuesto (lo crea la primera vez). */
export async function ensureQuoteToken(tx: Tx, quoteId: string): Promise<string> {
  const cur = await tx.one<{ public_token: string | null }>(`select public_token from quotes where id = $1`, [quoteId]);
  if (cur?.public_token) return cur.public_token;
  const token = randomBytes(24).toString("base64url");
  await tx.query(`update quotes set public_token = $2 where id = $1 and public_token is null`, [quoteId, token]);
  return (await tx.one<{ public_token: string }>(`select public_token from quotes where id = $1`, [quoteId]))!.public_token;
}

// ---------------------------------------------------------------------------
// Al recibir una solicitud (formulario web)
// ---------------------------------------------------------------------------

/** Contacto abierto con el mismo email o teléfono, si la automatización de duplicados está activa. */
export async function findOpenDuplicate(tx: Tx, email: string | null, phone: string | null): Promise<{ id: string; folio: string } | null> {
  if (!(await getAutomation(tx, "unificar_duplicados")).enabled) return null;
  const digits = phone?.replace(/\D/g, "").slice(-9) ?? "";
  if (!email && digits.length < 9) return null;
  return tx.one<{ id: string; folio: string }>(
    `select id, folio from contacts
      where stage not in ('ganado','perdido')
        and ((($1::text) is not null and lower(email) = lower($1::text))
          or (length($2::text) = 9 and right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 9) = $2::text))
      order by created_at desc limit 1`, [email, digits]);
}

/** Reparte el contacto a quien menos contactos abiertos tenga y le pone «Llamar» como próximo paso. */
async function autoAssign(tx: Tx, contactId: string) {
  const a = await getAutomation(tx, "asignacion_automatica");
  if (!a.enabled) return null;
  const c = await tx.one<{ owner_id: string | null; name: string }>(`select owner_id, name from contacts where id = $1`, [contactId]);
  if (!c || c.owner_id) return null;
  const u = await tx.one<{ id: string; name: string }>(
    `select u.id, u.name from users u
      where u.active and u.role in ('propietario','administrador','comercial')
      order by (select count(*) from contacts c where c.owner_id = u.id and c.stage not in ('ganado','perdido')),
               (select max(c.created_at) from contacts c where c.owner_id = u.id) nulls first, u.created_at
      limit 1`);
  if (!u) return null;
  if (!(await claim(tx, "asignacion_automatica", contactId, `Asignado a ${u.name}`))) return null;
  const hours = Math.min(Math.max(a.config.hours ?? 2, 1), 240);
  await tx.query(
    `update contacts set owner_id = $2, next_action = coalesce(next_action, $3), next_action_at = coalesce(next_action_at, now() + make_interval(hours => $4)) where id = $1`,
    [contactId, u.id, `Llamar a ${c.name}`, hours]);
  await logActivity(tx, { contactId, type: "automatizacion", body: `Asignado automáticamente a ${u.name}. Próximo paso: llamar en ${hours} h.` });
  return u;
}

/**
 * Todo lo que ocurre al llegar una solicitud: reparto, aviso al equipo y respuesta al cliente.
 * `repeat` indica que es un cliente que ya estaba en la lista y ha vuelto a escribir.
 */
export async function onNewLead(tx: Tx, contactId: string, opts: { repeat?: boolean } = {}) {
  const stamp = opts.repeat ? `${contactId}:${Date.now()}` : contactId;
  await autoAssign(tx, contactId);

  const c = await tx.one<{ folio: string; name: string; phone: string | null; email: string | null; city: string | null; postal_code: string | null; service: string | null; timeframe: string | null; description: string | null; owner_email: string | null }>(
    `select c.folio, c.name, c.phone, c.email, c.city, c.postal_code, s.name as service, c.timeframe, c.description, u.email as owner_email
       from contacts c left join services s on s.id = c.service_id left join users u on u.id = c.owner_id where c.id = $1`, [contactId]);
  if (!c) return;
  const cv = await companyVars(tx);

  // Aviso al equipo.
  const notify = await getAutomation(tx, "aviso_nueva_solicitud");
  if (notify.enabled && notify.config.sendEmail !== false && (await claim(tx, "aviso_nueva_solicitud", stamp, opts.repeat ? "Aviso: cliente que vuelve a escribir" : "Aviso de nueva solicitud"))) {
    const configured = (notify.config.recipients ?? []).filter(Boolean);
    const companyEmails = (await tx.one<{ notification_emails: string[] }>(`select notification_emails from companies where id = app_company_id()`))?.notification_emails ?? [];
    const base = configured.length ? configured : companyEmails.length ? companyEmails : await companyOwnerEmails(tx);
    const recipients = [...new Set([...base, ...(c.owner_email ? [c.owner_email] : [])])];
    const tpl = await getTemplate(tx, "aviso_nueva_solicitud");
    const vars = {
      ...cv, folio: padFolio(c.folio), nombre: opts.repeat ? `${c.name} (ya estaba en tu lista)` : c.name, telefono: c.phone, email: c.email,
      localidad: [c.postal_code, c.city].filter(Boolean).join(" "), servicio: c.service ?? "Sin especificar",
      plazo: c.timeframe ? TIMEFRAMES[c.timeframe as keyof typeof TIMEFRAMES] ?? c.timeframe : null,
      descripcion: c.description, enlace: link(`/contactos/${contactId}`),
    };
    for (const to of recipients) {
      await enqueueEmail(tx, { to, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "contact", relatedId: contactId, automationKey: "aviso_nueva_solicitud" });
    }
  }

  // Respuesta al cliente.
  const reply = await getAutomation(tx, "respuesta_cliente");
  if (reply.enabled && c.email && (await claim(tx, "respuesta_cliente", stamp, `Confirmación enviada a ${c.email}`))) {
    const tpl = await getTemplate(tx, "respuesta_cliente");
    const vars = { ...cv, nombre: c.name.split(" ")[0], folio: padFolio(c.folio), servicio: c.service?.toLowerCase() ?? "tu instalación" };
    await enqueueEmail(tx, { to: c.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "contact", relatedId: contactId, automationKey: "respuesta_cliente" });
    await logActivity(tx, { contactId, type: "automatizacion", body: `Se ha enviado al cliente la confirmación de que hemos recibido su solicitud.` });
  }
}

/** @deprecated Mantener compatibilidad: usar onNewLead. */
export const notifyNewLead = (tx: Tx, contactId: string) => onNewLead(tx, contactId);

// ---------------------------------------------------------------------------
// Al trabajar la venta (los llaman las acciones de la aplicación)
// ---------------------------------------------------------------------------

/** Al programar una visita: la ficha pasa a «Visita programada». */
export async function onVisitScheduled(tx: Tx, contactId: string, userId: string | null) {
  if (!(await getAutomation(tx, "fase_automatica")).enabled) return;
  const c = await tx.one<{ stage: string }>(`select stage from contacts where id = $1`, [contactId]);
  if (c && ["nuevo", "pendiente_contactar"].includes(c.stage)) {
    await changeStage(tx, contactId, "visita_programada", userId, "Fase cambiada automáticamente al programar la visita", null);
  }
}

/** Al completar una tarea: si era una visita, se crea la tarea de preparar el presupuesto. */
export async function onTaskDone(tx: Tx, taskId: string) {
  const t = await tx.one<{ kind: string; contact_id: string | null; assigned_to: string | null; contact_name: string | null }>(
    `select t.kind, t.contact_id, t.assigned_to, c.name as contact_name from tasks t left join contacts c on c.id = t.contact_id where t.id = $1`, [taskId]);
  if (!t || t.kind !== "visita" || !t.contact_id) return;
  const a = await getAutomation(tx, "tarea_tras_visita");
  if (!a.enabled || a.config.createTask === false) return;
  const hasQuote = await tx.one(`select 1 from quotes where contact_id = $1 and status in ('borrador','revisado','enviado','aceptado')`, [t.contact_id]);
  if (hasQuote) return;
  if (!(await claim(tx, "tarea_tras_visita", taskId, `Preparar presupuesto para ${t.contact_name}`))) return;
  const due = madridLocalToDate(`${addDaysIso(todayMadrid(), 1)}T10:00`);
  await tx.query(
    `insert into tasks(company_id, kind, title, due_at, contact_id, assigned_to, source) values (app_company_id(), 'tarea', $1, $2, $3, $4, 'automatizacion')`,
    [`Preparar presupuesto para ${t.contact_name}`, due, t.contact_id, t.assigned_to]);
  await tx.query(`update contacts set next_action = $2, next_action_at = $3 where id = $1`, [t.contact_id, "Preparar presupuesto", due]);
  await logActivity(tx, { contactId: t.contact_id, type: "automatizacion", body: "Visita hecha: se crea la tarea «Preparar presupuesto» para mañana." });
}

/** Cambios de estado del presupuesto que mueven la ficha de fase. */
export async function onQuoteStatus(tx: Tx, quoteId: string, to: QuoteStatus, userId: string | null) {
  if (!(await getAutomation(tx, "fase_automatica")).enabled) return;
  const q = await tx.one<{ contact_id: string; code: string; subtotal_cents: string; stage: string }>(
    `select q.contact_id, q.code, q.subtotal_cents, c.stage from quotes q join contacts c on c.id = q.contact_id where q.id = $1`, [quoteId]);
  if (!q) return;
  if (to === "enviado" && ["nuevo", "pendiente_contactar", "visita_programada"].includes(q.stage)) {
    await changeStage(tx, q.contact_id, "presupuesto_enviado", userId, `Presupuesto ${q.code} enviado`, null);
  }
  if (to === "aceptado" && q.stage !== "ganado") {
    await changeStage(tx, q.contact_id, "ganado", userId, `Presupuesto ${q.code} aceptado`, null);
    await tx.query(`update contacts set estimated_amount_cents = $2 where id = $1`, [q.contact_id, q.subtotal_cents]);
  }
  if (to === "rechazado" && !["ganado", "perdido"].includes(q.stage)) {
    const otherOpen = await tx.one(`select 1 from quotes where contact_id = $1 and id <> $2 and status in ('borrador','revisado','enviado')`, [q.contact_id, quoteId]);
    if (!otherOpen) await changeStage(tx, q.contact_id, "perdido", userId, null, `Rechazó el presupuesto ${q.code}`);
  }
}

// ---------------------------------------------------------------------------
// Programadas (cron diario y ejecución automática al usar la aplicación)
// ---------------------------------------------------------------------------

type Runner = (companyId: string, cfg: AutomationConfig, report: RunReport) => Promise<void>;

/** Ejecuta `fn` por cada caso en su propia transacción; un fallo no frena a los demás. */
async function forEachCase<T>(companyId: string, key: AutomationKey, items: T[], dedupe: (i: T) => string, fn: (tx: Tx, i: T) => Promise<boolean | void>, report: RunReport) {
  for (const i of items) {
    try {
      const did = await withTenant({ companyId, userId: null }, (tx) => fn(tx, i));
      if (did !== false) report.actions[key]++;
    } catch (e) {
      report.errors.push(`${key}: ${await recordError(companyId, key, dedupe(i), e)}`);
    }
  }
}

const runQuoteFollowup: Runner = async (companyId, cfg, report) => {
  const days = Math.min(Math.max(cfg.days ?? 3, 1), 60);
  const candidates = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string; code: string; sent_at: string }>(
      `select q.id, q.code, q.sent_at from quotes q
        where q.status = 'enviado' and q.sent_at < now() - make_interval(days => $1)
          and not exists (
            select 1 from activities a
             where (a.quote_id = q.id or a.contact_id = q.contact_id)
               and a.created_at > q.sent_at + interval '1 minute'
               and a.type in ('nota','llamada','email','whatsapp','visita','cambio_fase'))
        limit 100`, [days]));
  const dedupe = (q: { id: string; sent_at: string }) => `${q.id}:${new Date(q.sent_at).toISOString().slice(0, 10)}`;
  await forEachCase(companyId, "seguimiento_presupuesto", candidates, dedupe, async (tx, q) => {
    if (!(await claim(tx, "seguimiento_presupuesto", dedupe(q), `Seguimiento de ${q.code}`))) return false;
    const d = await tx.one<{ contact_id: string; contact_name: string; total_cents: string; sent_at: string; owner_id: string | null; owner_name: string | null; owner_email: string | null }>(
      `select q.contact_id, c.name as contact_name, q.total_cents, q.sent_at, coalesce(c.owner_id, q.created_by) as owner_id,
              u.name as owner_name, u.email as owner_email
         from quotes q join contacts c on c.id = q.contact_id
         left join users u on u.id = coalesce(c.owner_id, q.created_by) where q.id = $1`, [q.id]);
    if (!d) return false;
    if (cfg.createTask !== false) {
      await tx.query(
        `insert into tasks(company_id, kind, title, due_at, contact_id, quote_id, assigned_to, source) values (app_company_id(), 'tarea', $1, now(), $2, $3, $4, 'automatizacion')`,
        [`Seguimiento del presupuesto ${q.code}`, d.contact_id, q.id, d.owner_id]);
    }
    await logActivity(tx, { contactId: d.contact_id, quoteId: q.id, type: "automatizacion", body: `Recordatorio automático: ${q.code} lleva ${days} días o más sin seguimiento.` });
    if (cfg.sendEmail !== false && d.owner_email) {
      const tpl = await getTemplate(tx, "seguimiento_presupuesto");
      const dias = Math.floor((Date.now() - new Date(d.sent_at).getTime()) / 86400_000);
      const vars = { ...(await companyVars(tx)), codigo: q.code, cliente: d.contact_name, total: formatCents(d.total_cents), dias, enviado: fmtDate(d.sent_at), responsable: d.owner_name, enlace: link(`/presupuestos/${q.id}`) };
      await enqueueEmail(tx, { to: d.owner_email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "quote", relatedId: q.id, automationKey: "seguimiento_presupuesto" });
    }
  }, report);
};

const runVisitReminder: Runner = async (companyId, cfg, report) => {
  if (cfg.sendEmail === false) return;
  const hours = Math.min(Math.max(cfg.hoursBefore ?? 24, 1), 168);
  const visits = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string; due_at: string }>(
      `select id, due_at from tasks where kind = 'visita' and done_at is null and due_at > now() and due_at <= now() + make_interval(hours => $1) limit 200`, [hours]));
  const dedupe = (v: { id: string; due_at: string }) => `${v.id}:${new Date(v.due_at).toISOString()}`;
  await forEachCase(companyId, "recordatorio_visita", visits, dedupe, async (tx, v) => {
    const d = await tx.one<{ title: string; due_at: string; location: string | null; contact_name: string | null; phone: string | null; assignee: string | null; email: string | null; contact_id: string | null }>(
      `select t.title, t.due_at, t.location, c.name as contact_name, c.phone, u.name as assignee, u.email, t.contact_id
         from tasks t left join contacts c on c.id = t.contact_id left join users u on u.id = t.assigned_to where t.id = $1`, [v.id]);
    if (!d?.email) return false;
    if (!(await claim(tx, "recordatorio_visita", dedupe(v), "Recordatorio de visita"))) return false;
    const tpl = await getTemplate(tx, "recordatorio_visita");
    const vars = { ...(await companyVars(tx)), titulo: d.title, fecha: fmtDate(d.due_at), hora: fmtTime(d.due_at), lugar: d.location, cliente: d.contact_name, telefono: d.phone, responsable: d.assignee, enlace: link(d.contact_id ? `/contactos/${d.contact_id}` : "/agenda") };
    await enqueueEmail(tx, { to: d.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "task", relatedId: v.id, automationKey: "recordatorio_visita" });
  }, report);
};

const runVisitReminderClient: Runner = async (companyId, cfg, report) => {
  if (cfg.sendEmail === false) return;
  const hours = Math.min(Math.max(cfg.hoursBefore ?? 24, 1), 168);
  const visits = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string; due_at: string }>(
      `select t.id, t.due_at from tasks t join contacts c on c.id = t.contact_id
        where t.kind = 'visita' and t.done_at is null and c.email is not null
          and t.due_at > now() + interval '2 hours' and t.due_at <= now() + make_interval(hours => $1) limit 200`, [hours]));
  const dedupe = (v: { id: string; due_at: string }) => `${v.id}:${new Date(v.due_at).toISOString()}`;
  await forEachCase(companyId, "recordatorio_visita_cliente", visits, dedupe, async (tx, v) => {
    const d = await tx.one<{ due_at: string; location: string | null; contact_id: string; contact_name: string; email: string; address: string | null; city: string | null; assignee: string | null }>(
      `select t.due_at, t.location, c.id as contact_id, c.name as contact_name, c.email, c.address, c.city, u.name as assignee
         from tasks t join contacts c on c.id = t.contact_id left join users u on u.id = t.assigned_to where t.id = $1`, [v.id]);
    if (!d) return false;
    if (!(await claim(tx, "recordatorio_visita_cliente", dedupe(v), `Recordatorio de visita enviado a ${d.email}`))) return false;
    const tpl = await getTemplate(tx, "recordatorio_visita_cliente");
    const vars = {
      ...(await companyVars(tx)), nombre: d.contact_name.split(" ")[0], fecha: fmtDateLong(d.due_at), hora: fmtTime(d.due_at),
      lugar: d.location || [d.address, d.city].filter(Boolean).join(", ") || null, tecnico: d.assignee,
    };
    await enqueueEmail(tx, { to: d.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "task", relatedId: v.id, automationKey: "recordatorio_visita_cliente" });
    await logActivity(tx, { contactId: d.contact_id, type: "automatizacion", body: `Recordatorio de la visita enviado al cliente (${d.email}).` });
  }, report);
};

const runStaleLead: Runner = async (companyId, cfg, report) => {
  const hours = Math.min(Math.max(cfg.hours ?? 4, 1), 240);
  const leads = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string }>(`select id from contacts where stage = 'nuevo' and created_at < now() - make_interval(hours => $1) limit 100`, [hours]));
  await forEachCase(companyId, "tarea_contacto_nuevo", leads, (l) => l.id, async (tx, l) => {
    if (!(await claim(tx, "tarea_contacto_nuevo", l.id, "Tarea para contacto sin atender"))) return false;
    const d = await tx.one<{ folio: string; name: string; phone: string | null; owner_id: string | null; email: string | null }>(
      `select c.folio, c.name, c.phone, coalesce(c.owner_id, (select id from users where active and role = 'propietario' order by created_at limit 1)) as owner_id, u.email
         from contacts c
         left join users u on u.id = coalesce(c.owner_id, (select id from users where active and role = 'propietario' order by created_at limit 1))
        where c.id = $1`, [l.id]);
    if (!d) return false;
    if (cfg.createTask !== false) {
      await tx.query(`insert into tasks(company_id, kind, title, due_at, contact_id, assigned_to, source) values (app_company_id(), 'tarea', $1, now(), $2, $3, 'automatizacion')`,
        [`Llamar a ${d.name}${d.phone ? ` (${d.phone})` : ""}`, l.id, d.owner_id]);
    }
    await logActivity(tx, { contactId: l.id, type: "automatizacion", body: `Contacto sin atender más de ${hours} h: se crea tarea de llamada.` });
    if (cfg.sendEmail && d.email) {
      const tpl = await getTemplate(tx, "tarea_contacto_nuevo");
      const vars = { ...(await companyVars(tx)), folio: padFolio(d.folio), nombre: d.name, telefono: d.phone, horas: hours, enlace: link(`/contactos/${l.id}`) };
      await enqueueEmail(tx, { to: d.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "contact", relatedId: l.id, automationKey: "tarea_contacto_nuevo" });
    }
  }, report);
};

const runExpireQuotes: Runner = async (companyId, cfg, report) => {
  const quotes = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string }>(`select id from quotes where status = 'enviado' and valid_until < (now() at time zone 'Europe/Madrid')::date limit 200`));
  await forEachCase(companyId, "caducar_presupuestos", quotes, (q) => q.id, async (tx, q) => {
    if (!(await claim(tx, "caducar_presupuestos", q.id, "Presupuesto caducado"))) return false;
    const d = await tx.one<{ code: string; contact_id: string; contact_name: string; phone: string | null; owner_id: string | null }>(
      `update quotes q set status = 'caducado', decided_at = now() from contacts c
        where q.id = $1 and c.id = q.contact_id and q.status = 'enviado'
        returning q.code, q.contact_id, c.name as contact_name, c.phone, coalesce(c.owner_id, q.created_by) as owner_id`, [q.id]);
    if (!d) return false;
    await logActivity(tx, { contactId: d.contact_id, quoteId: q.id, type: "presupuesto", body: `Presupuesto ${d.code} caducado automáticamente: pasó su fecha de validez sin respuesta.`, meta: { status: "caducado" } });
    if (cfg.createTask !== false) {
      await tx.query(`insert into tasks(company_id, kind, title, due_at, contact_id, quote_id, assigned_to, source) values (app_company_id(), 'tarea', $1, now(), $2, $3, $4, 'automatizacion')`,
        [`Llamar a ${d.contact_name}: el presupuesto ${d.code} ha caducado`, d.contact_id, q.id, d.owner_id]);
    }
  }, report);
};

const runClientFollowup: Runner = async (companyId, cfg, report) => {
  if (cfg.sendEmail === false) return;
  const days = Math.min(Math.max(cfg.days ?? 5, 1), 60);
  const quotes = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string }>(
      `select q.id from quotes q join contacts c on c.id = q.contact_id
        where q.status = 'enviado' and c.email is not null and q.sent_at < now() - make_interval(days => $1)
          and q.valid_until >= (now() at time zone 'Europe/Madrid')::date limit 100`, [days]));
  await forEachCase(companyId, "seguimiento_cliente", quotes, (q) => q.id, async (tx, q) => {
    if (!(await claim(tx, "seguimiento_cliente", q.id, "Recordatorio del presupuesto al cliente"))) return false;
    const d = await tx.one<{ code: string; total_cents: string; contact_id: string; contact_name: string; email: string }>(
      `select q.code, q.total_cents, c.id as contact_id, c.name as contact_name, c.email from quotes q join contacts c on c.id = q.contact_id where q.id = $1`, [q.id]);
    if (!d) return false;
    const token = await ensureQuoteToken(tx, q.id);
    const tpl = await getTemplate(tx, "seguimiento_cliente");
    const vars = { ...(await companyVars(tx)), nombre: d.contact_name.split(" ")[0], codigo: d.code, total: formatCents(d.total_cents), enlace: publicQuoteUrl(token) };
    await enqueueEmail(tx, { to: d.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "quote", relatedId: q.id, automationKey: "seguimiento_cliente" });
    await logActivity(tx, { contactId: d.contact_id, quoteId: q.id, type: "automatizacion", body: `Recordatorio del presupuesto ${d.code} enviado al cliente (${d.email}).` });
  }, report);
};

const runDailySummary: Runner = async (companyId, cfg, report) => {
  if (cfg.sendEmail === false) return;
  // Solo a partir de las 7:00 (hora de España) y una vez al día por persona.
  if (madridParts(new Date()).hour < 7) return;
  const today = todayMadrid();
  const start = madridLocalToDate(`${today}T00:00`)!;
  const end = madridLocalToDate(`${addDaysIso(today, 1)}T00:00`)!;
  const users = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string; name: string; email: string; role: string }>(`select id, name, email, role from users where active and role <> 'lectura'`));
  await forEachCase(companyId, "resumen_diario", users, (u) => `${u.id}:${today}`, async (tx, u) => {
    const tasks = await tx.query<{ kind: string; title: string; due_at: string; location: string | null; contact_name: string | null }>(
      `select t.kind, t.title, t.due_at, t.location, c.name as contact_name from tasks t left join contacts c on c.id = t.contact_id
        where t.assigned_to = $1 and t.done_at is null and t.due_at >= $2 and t.due_at < $3 order by t.due_at limit 30`, [u.id, start, end]);
    const overdue = (await tx.one<{ n: number }>(`select count(*)::int as n from tasks where assigned_to = $1 and done_at is null and due_at < $2`, [u.id, start]))?.n ?? 0;
    const manager = u.role === "propietario" || u.role === "administrador";
    const fresh = (await tx.one<{ n: number }>(
      `select count(*)::int as n from contacts where stage = 'nuevo' and ${manager ? "(owner_id = $1 or owner_id is null)" : "owner_id = $1"}`, [u.id]))?.n ?? 0;
    if (!tasks.length && !overdue && !fresh) return false;
    if (!(await claim(tx, "resumen_diario", `${u.id}:${today}`, `Resumen del día para ${u.name}`))) return false;
    const visits = tasks.filter((t) => t.kind === "visita");
    const todo = tasks.filter((t) => t.kind !== "visita");
    const line = (t: (typeof tasks)[number]) => `  · ${fmtTime(t.due_at)} · ${t.title}${t.contact_name && !t.title.includes(t.contact_name) ? ` · ${t.contact_name}` : ""}${t.location ? ` — ${t.location}` : ""}`;
    const parts = [`Buenos días, ${u.name.split(" ")[0]}. Esto es lo que tienes hoy, ${fmtDateLong(start)}:`];
    if (visits.length) parts.push(`Visitas (${visits.length}):\n${visits.map(line).join("\n")}`);
    if (todo.length) parts.push(`Tareas (${todo.length}):\n${todo.map(line).join("\n")}`);
    if (overdue) parts.push(`Tienes ${overdue} tarea${overdue === 1 ? "" : "s"} atrasada${overdue === 1 ? "" : "s"}.`);
    if (fresh) parts.push(`${fresh} solicitud${fresh === 1 ? "" : "es"} nueva${fresh === 1 ? "" : "s"} esperando la primera llamada.`);
    parts.push(`Abrir tu agenda: ${link("/agenda")}`);
    const subject = `Tu día: ${[visits.length && `${visits.length} visita${visits.length === 1 ? "" : "s"}`, todo.length && `${todo.length} tarea${todo.length === 1 ? "" : "s"}`, overdue && `${overdue} atrasada${overdue === 1 ? "" : "s"}`, fresh && `${fresh} nueva${fresh === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}`;
    await enqueueEmail(tx, { to: u.email, subject, body: parts.join("\n\n"), relatedType: "user", relatedId: u.id, automationKey: "resumen_diario" });
  }, report);
};

const RUNNERS: Partial<Record<AutomationKey, Runner>> = {
  seguimiento_presupuesto: runQuoteFollowup,
  recordatorio_visita: runVisitReminder,
  recordatorio_visita_cliente: runVisitReminderClient,
  tarea_contacto_nuevo: runStaleLead,
  caducar_presupuestos: runExpireQuotes,
  seguimiento_cliente: runClientFollowup,
  resumen_diario: runDailySummary,
};

/** Ejecuta las automatizaciones programadas de todas las empresas activas (o de una). */
export async function runAutomations(opts: { companyId?: string } = {}): Promise<RunReport> {
  const report: RunReport = {
    companies: 0,
    actions: Object.fromEntries(AUTOMATION_KEYS.map((k) => [k, 0])) as Record<AutomationKey, number>,
    errors: [],
    outbox: { accepted: 0, failed: 0, retrying: 0, notConfigured: 0 },
  };
  const companies = await withSystem((tx) =>
    tx.query<{ id: string }>(`select id from companies where active and ($1::uuid is null or id = $1::uuid)`, [opts.companyId ?? null]));
  report.companies = companies.length;
  for (const c of companies) {
    const autos = await withTenant({ companyId: c.id, userId: null }, async (tx) => {
      const out: { key: AutomationKey; config: AutomationConfig }[] = [];
      for (const key of Object.keys(RUNNERS) as AutomationKey[]) {
        const a = await getAutomation(tx, key);
        if (a.enabled) out.push({ key, config: a.config });
      }
      return out;
    });
    for (const a of autos) await RUNNERS[a.key]!(c.id, a.config, report);
  }
  report.outbox = await processOutbox({ companyId: opts.companyId, limit: 50 });
  return report;
}

/**
 * Ejecución automática mientras se usa la aplicación: como mucho una vez cada 15 minutos por empresa.
 * Así los recordatorios salen a su hora aunque el cron del plan gratuito solo corra una vez al día.
 */
export async function maybeAutoRun(companyId: string) {
  if (!(await rateLimit(`autorun:${companyId}`, 1, 900))) return;
  await runAutomations({ companyId }).catch((e) => console.error("[automatizaciones] ejecución automática", e));
}
