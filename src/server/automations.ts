import "server-only";
import { withSystem, withTenant, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueueEmail, processOutbox } from "@/lib/email/outbox";
import { AUTOMATION_DEFAULTS, renderTemplate, type AutomationConfig, type AutomationKey, type TemplateKey } from "@/lib/company-defaults";
import { formatCents } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/dates";
import { padFolio } from "@/lib/brand";
import { TIMEFRAMES } from "@/lib/stages";
import { logActivity } from "./contacts";

export interface RunReport {
  companies: number;
  actions: Record<AutomationKey, number>;
  errors: string[];
  outbox: Awaited<ReturnType<typeof processOutbox>>;
}

async function getTemplate(tx: Tx, key: TemplateKey) {
  return tx.one<{ subject: string; body: string }>(`select subject, body from email_templates where key = $1`, [key]);
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

/** Aviso inmediato de nueva solicitud (lo llama el formulario público dentro de su transacción). */
export async function notifyNewLead(tx: Tx, contactId: string) {
  const auto = await tx.one<{ enabled: boolean; config: AutomationConfig }>(`select enabled, config from automations where key = 'aviso_nueva_solicitud'`);
  if (!auto?.enabled) return { skipped: "desactivada" };
  if (!(await claim(tx, "aviso_nueva_solicitud", contactId, "Aviso de nueva solicitud"))) return { skipped: "duplicado" };
  const c = await tx.one<{ folio: string; name: string; phone: string | null; email: string | null; city: string | null; postal_code: string | null; service: string | null; timeframe: string | null; description: string | null; company: string }>(
    `select c.folio, c.name, c.phone, c.email, c.city, c.postal_code, s.name as service, c.timeframe, c.description, co.name as company
       from contacts c left join services s on s.id = c.service_id join companies co on co.id = c.company_id where c.id = $1`, [contactId]);
  if (!c) return { skipped: "sin contacto" };
  const configured = (auto.config.recipients ?? []).filter(Boolean);
  const companyEmails = (await tx.one<{ notification_emails: string[] }>(`select notification_emails from companies where id = app_company_id()`))?.notification_emails ?? [];
  const recipients = [...new Set(configured.length ? configured : companyEmails.length ? companyEmails : await companyOwnerEmails(tx))];
  const tpl = await getTemplate(tx, "aviso_nueva_solicitud");
  if (!tpl || !recipients.length) return { skipped: "sin destinatarios" };
  const vars = {
    empresa: c.company, folio: padFolio(c.folio), nombre: c.name, telefono: c.phone, email: c.email,
    localidad: [c.postal_code, c.city].filter(Boolean).join(" "), servicio: c.service ?? "Sin especificar",
    plazo: c.timeframe ? TIMEFRAMES[c.timeframe as keyof typeof TIMEFRAMES] ?? c.timeframe : null,
    descripcion: c.description, enlace: link(`/contactos/${contactId}`),
  };
  for (const to of recipients) {
    await enqueueEmail(tx, { to, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "contact", relatedId: contactId, automationKey: "aviso_nueva_solicitud" });
  }
  return { queued: recipients.length };
}

async function runQuoteFollowup(companyId: string, cfg: AutomationConfig, report: RunReport) {
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
  for (const q of candidates) {
    const dedupe = `${q.id}:${new Date(q.sent_at).toISOString().slice(0, 10)}`;
    try {
      await withTenant({ companyId, userId: null }, async (tx) => {
        if (!(await claim(tx, "seguimiento_presupuesto", dedupe, `Seguimiento de ${q.code}`))) return;
        const d = await tx.one<{ contact_id: string; contact_name: string; total_cents: string; sent_at: string; owner_id: string | null; owner_name: string | null; owner_email: string | null; company: string }>(
          `select q.contact_id, c.name as contact_name, q.total_cents, q.sent_at, coalesce(c.owner_id, q.created_by) as owner_id,
                  u.name as owner_name, u.email as owner_email, co.name as company
             from quotes q join contacts c on c.id = q.contact_id join companies co on co.id = q.company_id
             left join users u on u.id = coalesce(c.owner_id, q.created_by) where q.id = $1`, [q.id]);
        if (!d) return;
        if (cfg.createTask !== false) {
          await tx.query(
            `insert into tasks(company_id, kind, title, due_at, contact_id, quote_id, assigned_to, source) values (app_company_id(), 'tarea', $1, now(), $2, $3, $4, 'automatizacion')`,
            [`Seguimiento del presupuesto ${q.code}`, d.contact_id, q.id, d.owner_id]);
        }
        await logActivity(tx, { contactId: d.contact_id, quoteId: q.id, type: "automatizacion", body: `Recordatorio automático: ${q.code} lleva ${days} días o más sin seguimiento.` });
        if (cfg.sendEmail !== false && d.owner_email) {
          const tpl = await getTemplate(tx, "seguimiento_presupuesto");
          const dias = Math.floor((Date.now() - new Date(d.sent_at).getTime()) / 86400_000);
          const vars = { empresa: d.company, codigo: q.code, cliente: d.contact_name, total: formatCents(d.total_cents), dias, enviado: fmtDate(d.sent_at), responsable: d.owner_name, enlace: link(`/presupuestos/${q.id}`) };
          if (tpl) await enqueueEmail(tx, { to: d.owner_email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "quote", relatedId: q.id, automationKey: "seguimiento_presupuesto" });
        }
        report.actions.seguimiento_presupuesto++;
      });
    } catch (e) {
      report.errors.push(`seguimiento_presupuesto ${q.code}: ${await recordError(companyId, "seguimiento_presupuesto", dedupe, e)}`);
    }
  }
}

async function runVisitReminder(companyId: string, cfg: AutomationConfig, report: RunReport) {
  const hours = Math.min(Math.max(cfg.hoursBefore ?? 24, 1), 168);
  const visits = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string; due_at: string }>(
      `select id, due_at from tasks where kind = 'visita' and done_at is null and due_at > now() and due_at <= now() + make_interval(hours => $1) limit 200`, [hours]));
  for (const v of visits) {
    const dedupe = `${v.id}:${new Date(v.due_at).toISOString()}`;
    try {
      await withTenant({ companyId, userId: null }, async (tx) => {
        if (!(await claim(tx, "recordatorio_visita", dedupe, "Recordatorio de visita"))) return;
        const d = await tx.one<{ title: string; due_at: string; location: string | null; contact_name: string | null; phone: string | null; assignee: string | null; email: string | null; company: string; contact_id: string | null }>(
          `select t.title, t.due_at, t.location, c.name as contact_name, c.phone, u.name as assignee, u.email, co.name as company, t.contact_id
             from tasks t left join contacts c on c.id = t.contact_id left join users u on u.id = t.assigned_to join companies co on co.id = t.company_id
            where t.id = $1`, [v.id]);
        if (!d?.email || cfg.sendEmail === false) return;
        const tpl = await getTemplate(tx, "recordatorio_visita");
        const vars = { empresa: d.company, titulo: d.title, fecha: fmtDate(d.due_at), hora: fmtTime(d.due_at), lugar: d.location, cliente: d.contact_name, telefono: d.phone, responsable: d.assignee, enlace: link(d.contact_id ? `/contactos/${d.contact_id}` : "/agenda") };
        if (tpl) await enqueueEmail(tx, { to: d.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "task", relatedId: v.id, automationKey: "recordatorio_visita" });
        report.actions.recordatorio_visita++;
      });
    } catch (e) {
      report.errors.push(`recordatorio_visita: ${await recordError(companyId, "recordatorio_visita", dedupe, e)}`);
    }
  }
}

async function runStaleLead(companyId: string, cfg: AutomationConfig, report: RunReport) {
  const hours = Math.min(Math.max(cfg.hours ?? 4, 1), 240);
  const leads = await withTenant({ companyId, userId: null }, (tx) =>
    tx.query<{ id: string }>(`select id from contacts where stage = 'nuevo' and created_at < now() - make_interval(hours => $1) limit 100`, [hours]));
  for (const l of leads) {
    try {
      await withTenant({ companyId, userId: null }, async (tx) => {
        if (!(await claim(tx, "tarea_contacto_nuevo", l.id, "Tarea para contacto sin atender"))) return;
        const d = await tx.one<{ folio: string; name: string; phone: string | null; owner_id: string | null; email: string | null; company: string }>(
          `select c.folio, c.name, c.phone, coalesce(c.owner_id, (select id from users where active and role = 'propietario' order by created_at limit 1)) as owner_id,
                  u.email, co.name as company
             from contacts c join companies co on co.id = c.company_id
             left join users u on u.id = coalesce(c.owner_id, (select id from users where active and role = 'propietario' order by created_at limit 1))
            where c.id = $1`, [l.id]);
        if (!d) return;
        if (cfg.createTask !== false) {
          await tx.query(`insert into tasks(company_id, kind, title, due_at, contact_id, assigned_to, source) values (app_company_id(), 'tarea', $1, now(), $2, $3, 'automatizacion')`,
            [`Llamar a ${d.name}${d.phone ? ` (${d.phone})` : ""}`, l.id, d.owner_id]);
        }
        await logActivity(tx, { contactId: l.id, type: "automatizacion", body: `Contacto sin atender más de ${hours} h: se crea tarea de llamada.` });
        if (cfg.sendEmail && d.email) {
          const tpl = await getTemplate(tx, "tarea_contacto_nuevo");
          const vars = { empresa: d.company, folio: padFolio(d.folio), nombre: d.name, telefono: d.phone, horas: hours, enlace: link(`/contactos/${l.id}`) };
          if (tpl) await enqueueEmail(tx, { to: d.email, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "contact", relatedId: l.id, automationKey: "tarea_contacto_nuevo" });
        }
        report.actions.tarea_contacto_nuevo++;
      });
    } catch (e) {
      report.errors.push(`tarea_contacto_nuevo: ${await recordError(companyId, "tarea_contacto_nuevo", l.id, e)}`);
    }
  }
}

/** Ejecuta las automatizaciones programadas de todas las empresas (o de una). */
export async function runAutomations(opts: { companyId?: string } = {}): Promise<RunReport> {
  const report: RunReport = {
    companies: 0,
    actions: { aviso_nueva_solicitud: 0, seguimiento_presupuesto: 0, recordatorio_visita: 0, tarea_contacto_nuevo: 0 },
    errors: [],
    outbox: { accepted: 0, failed: 0, retrying: 0, notConfigured: 0 },
  };
  const autos = await withSystem((tx) =>
    tx.query<{ company_id: string; key: AutomationKey; config: AutomationConfig }>(
      `select company_id, key, config from automations where enabled and ($1::uuid is null or company_id = $1::uuid)`, [opts.companyId ?? null]));
  report.companies = new Set(autos.map((a) => a.company_id)).size;
  for (const a of autos) {
    const cfg = { ...AUTOMATION_DEFAULTS[a.key].config, ...a.config };
    if (a.key === "seguimiento_presupuesto") await runQuoteFollowup(a.company_id, cfg, report);
    if (a.key === "recordatorio_visita") await runVisitReminder(a.company_id, cfg, report);
    if (a.key === "tarea_contacto_nuevo") await runStaleLead(a.company_id, cfg, report);
  }
  report.outbox = await processOutbox({ companyId: opts.companyId, limit: 50 });
  return report;
}
