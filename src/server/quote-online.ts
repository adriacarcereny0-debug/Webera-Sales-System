import "server-only";
import { z } from "zod";
import { withSystem, withTenant, type Tx } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/outbox";
import { renderTemplate } from "@/lib/company-defaults";
import { formatCents } from "@/lib/money";
import { fmtDate, todayMadrid } from "@/lib/dates";
import { env } from "@/lib/env";
import { logActivity } from "./contacts";
import { getQuote } from "./quotes";
import { getCompany } from "./company";
import { ensureQuoteToken, getTemplate, onQuoteStatus, publicQuoteUrl } from "./automations";

/** Formato del enlace público: 32 caracteres base64url (24 bytes aleatorios). */
export const isQuoteToken = (t: string) => /^[A-Za-z0-9_-]{32}$/.test(t);

/**
 * Envía el presupuesto al cliente por email con el enlace para verlo y aceptarlo.
 * Si estaba «Revisado», pasa a «Enviado» (y la ficha a «Presupuesto enviado»).
 */
export async function sendQuoteByEmail(tx: Tx, quoteId: string, userId: string, toEmail: string | null): Promise<{ error: string } | { to: string; code: string }> {
  const q = await tx.one<{ status: string; code: string; total_cents: string; valid_until: string; contact_id: string; contact_name: string; contact_email: string | null }>(
    `select q.status, q.code, q.total_cents, to_char(q.valid_until, 'YYYY-MM-DD') as valid_until, q.contact_id, c.name as contact_name, c.email as contact_email
       from quotes q join contacts c on c.id = q.contact_id where q.id = $1 for update of q`, [quoteId]);
  if (!q) return { error: "El presupuesto no existe." };
  if (q.status === "borrador") return { error: "Antes de enviarlo, el presupuesto debe quedar revisado." };
  if (q.status !== "revisado" && q.status !== "enviado") return { error: "Este presupuesto ya tiene respuesta: no se puede reenviar." };
  if (q.valid_until < todayMadrid()) return { error: "La validez de este presupuesto ya ha terminado. Duplícalo con una fecha nueva." };
  const to = (toEmail?.trim().toLowerCase() || q.contact_email || "").trim();
  if (!z.string().email().safeParse(to).success) return { error: "Escribe el email del cliente." };

  const token = await ensureQuoteToken(tx, quoteId);
  const tpl = await getTemplate(tx, "envio_presupuesto");
  const c = await tx.one<{ name: string; phone: string | null; email: string | null }>(`select name, phone, email from companies where id = app_company_id()`);
  const vars = {
    empresa: c?.name, telefono_empresa: c?.phone, email_empresa: c?.email, nombre: q.contact_name.split(" ")[0], codigo: q.code,
    total: formatCents(q.total_cents), valido_hasta: fmtDate(q.valid_until), enlace: publicQuoteUrl(token),
  };
  await enqueueEmail(tx, { to, subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars), relatedType: "quote", relatedId: quoteId });
  await tx.query(`update quotes set emailed_at = now(), emailed_to = $2 where id = $1`, [quoteId, to]);
  if (!q.contact_email) await tx.query(`update contacts set email = $2 where id = $1`, [q.contact_id, to]);
  if (q.status === "revisado") {
    await tx.query(`update quotes set status = 'enviado', sent_at = now() where id = $1`, [quoteId]);
    await onQuoteStatus(tx, quoteId, "enviado", userId);
  }
  await logActivity(tx, { contactId: q.contact_id, quoteId, userId, type: "presupuesto", body: `Presupuesto ${q.code} enviado por email a ${to}, con enlace para verlo y aceptarlo.`, meta: { status: "enviado" } });
  return { to, code: q.code };
}

async function companyOfToken(token: string) {
  if (!isQuoteToken(token)) return null;
  return withSystem((tx) => tx.one<{ id: string; company_id: string }>(
    `select q.id, q.company_id from quotes q join companies c on c.id = q.company_id where q.public_token = $1 and c.active`, [token]));
}

/** Datos del presupuesto para la página pública. Anota la primera vez que el cliente lo abre. */
export async function getPublicQuote(token: string) {
  const ref = await companyOfToken(token);
  if (!ref) return null;
  return withTenant({ companyId: ref.company_id, userId: null }, async (tx) => {
    const q = await getQuote(tx, ref.id);
    if (!q) return null;
    if (!q.quote.client_viewed_at && q.quote.status === "enviado") {
      await tx.query(`update quotes set client_viewed_at = now() where id = $1 and client_viewed_at is null`, [ref.id]);
      await logActivity(tx, { contactId: q.quote.contact_id, quoteId: ref.id, type: "presupuesto", body: `El cliente ha abierto el presupuesto ${q.quote.code}.` });
    }
    const company = await getCompany(tx);
    const logo = company.has_logo ? await tx.one<{ data: Buffer; mime: string }>(`select logo_data as data, logo_mime as mime from companies where id = app_company_id()`) : null;
    return { ...q, company, logo };
  });
}

/** El cliente acepta o rechaza desde el enlace. Mueve la ficha, avisa al responsable y crea la siguiente tarea. */
export async function decidePublicQuote(token: string, decision: "aceptado" | "rechazado", note: string | null): Promise<{ error: string } | { ok: true }> {
  const ref = await companyOfToken(token);
  if (!ref) return { error: "Este enlace no es válido." };
  return withTenant({ companyId: ref.company_id, userId: null }, async (tx) => {
    const q = await tx.one<{ status: string; code: string; valid_until: string; total_cents: string; contact_id: string; contact_name: string; owner_id: string | null; owner_email: string | null }>(
      `select q.status, q.code, to_char(q.valid_until, 'YYYY-MM-DD') as valid_until, q.total_cents, q.contact_id, c.name as contact_name,
              coalesce(c.owner_id, q.created_by) as owner_id, u.email as owner_email
         from quotes q join contacts c on c.id = q.contact_id left join users u on u.id = coalesce(c.owner_id, q.created_by)
        where q.id = $1 for update of q`, [ref.id]);
    if (!q) return { error: "Este enlace no es válido." };
    if (q.status !== "enviado") return { error: "Este presupuesto ya tiene respuesta." };
    if (q.valid_until < todayMadrid()) return { error: "La validez de este presupuesto ha terminado. Contacta con la empresa para que te lo actualicen." };
    await tx.query(`update quotes set status = $2, decided_at = now(), client_note = $3 where id = $1`, [ref.id, decision, note]);
    const verb = decision === "aceptado" ? "ACEPTADO" : "rechazado";
    await logActivity(tx, {
      contactId: q.contact_id, quoteId: ref.id, type: "presupuesto",
      body: `El cliente ha ${verb} el presupuesto ${q.code} desde el enlace.${note ? ` Comentario: «${note}»` : ""}`, meta: { status: decision, via: "enlace" },
    });
    await onQuoteStatus(tx, ref.id, decision, null);
    if (decision === "aceptado") {
      await tx.query(
        `insert into tasks(company_id, kind, title, due_at, contact_id, quote_id, assigned_to, source) values (app_company_id(), 'tarea', $1, now(), $2, $3, $4, 'automatizacion')`,
        [`Planificar la instalación con ${q.contact_name} (${q.code} aceptado)`, q.contact_id, ref.id, q.owner_id]);
    }
    // Aviso a la persona responsable y a los emails de aviso de la empresa.
    const extra = (await tx.one<{ notification_emails: string[] }>(`select notification_emails from companies where id = app_company_id()`))?.notification_emails ?? [];
    const recipients = [...new Set([...(q.owner_email ? [q.owner_email] : []), ...extra])];
    for (const to of recipients) {
      await enqueueEmail(tx, {
        to, relatedType: "quote", relatedId: ref.id,
        subject: decision === "aceptado" ? `✓ ${q.contact_name} ha aceptado el presupuesto ${q.code}` : `${q.contact_name} ha rechazado el presupuesto ${q.code}`,
        body: [
          `${q.contact_name} ha ${verb} el presupuesto ${q.code} (${formatCents(q.total_cents)}) desde el enlace que recibió por email.`,
          note ? `Su comentario: «${note}»` : null,
          decision === "aceptado" ? "Se ha creado la tarea «Planificar la instalación» y la ficha ha pasado a «Ganado»." : null,
          `Abrir el presupuesto: ${env.appUrl}/presupuestos/${ref.id}`,
        ].filter(Boolean).join("\n\n"),
      });
    }
    return { ok: true as const };
  });
}
