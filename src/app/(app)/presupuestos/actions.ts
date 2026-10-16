"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ForbiddenError, requireCapability, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { computeQuote } from "@/lib/quotes/calc";
import { parseDecimal, parseEuroToCents } from "@/lib/money";
import { ensureQuoteToken, onQuoteStatus } from "@/server/automations";
import { sendQuoteByEmail } from "@/server/quote-online";
import { processOutbox } from "@/lib/email/outbox";
import { canTransitionQuote, isQuoteStatus, QUOTE_STATUS, type QuoteStatus } from "@/lib/stages";
import { logActivity } from "@/server/contacts";
import { getCompany } from "@/server/company";
import { nextQuoteCode } from "@/server/quotes";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

const itemSchema = z.object({
  description: z.string().trim().min(1, "Cada línea necesita un concepto.").max(500, "Concepto demasiado largo (máx. 500)."),
  quantity: z.string(),
  unit: z.string().trim().max(12).default("ud"),
  unit_price: z.string(),
  discount: z.string().optional().default("0"),
  tax_rate: z.coerce.number().min(0).max(100),
});

const quoteSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  contact_id: z.string().uuid("Elige el cliente del presupuesto."),
  title: z.string().trim().min(1, "Pon un título.").max(160),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  notes: z.string().trim().max(4000).optional(),
  next_step: z.string().trim().max(300).optional(),
  terms: z.string().trim().max(6000).optional(),
  items: z.string(),
});

export type QuoteActionState = ActionState & { lineErrors?: Record<number, string> };

export async function saveQuote(_: QuoteActionState, fd: FormData): Promise<QuoteActionState> {
  const s = await requireCapability("quotes.write");
  const parsed = quoteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.valid_until < d.issue_date) return { error: "La validez no puede ser anterior a la fecha del presupuesto." };

  let rawItems: unknown;
  try { rawItems = JSON.parse(d.items); } catch { return { error: "Líneas no válidas." }; }
  const arr = z.array(itemSchema).max(200).safeParse(rawItems);
  if (!arr.success) return { error: arr.error.issues[0].message };
  if (arr.data.length === 0) return { error: "Añade al menos una línea al presupuesto." };

  const lineErrors: Record<number, string> = {};
  const items = arr.data.map((it, i) => {
    const quantity = parseDecimal(it.quantity);
    const price = parseEuroToCents(it.unit_price);
    const discount = parseDecimal(it.discount || "0");
    if (quantity === null || quantity <= 0 || quantity > 1_000_000) lineErrors[i] = "Cantidad no válida.";
    else if (Math.round(quantity * 1000) / 1000 !== quantity) lineErrors[i] = "Máximo 3 decimales en la cantidad.";
    else if (price === null || price < 0) lineErrors[i] = "Precio no válido.";
    else if (discount === null || discount < 0 || discount > 100) lineErrors[i] = "Descuento entre 0 y 100.";
    return { description: it.description, unit: it.unit || "ud", quantity: quantity ?? 0, unitPriceCents: price ?? 0, discountPct: discount ?? 0, taxRate: it.tax_rate };
  });
  if (Object.keys(lineErrors).length) return { error: "Revisa las líneas marcadas.", lineErrors };
  const totals = computeQuote(items);

  const res = await tenant(s, async (tx) => {
    const company = await getCompany(tx);
    if (items.some((i) => !company.tax_rates.includes(i.taxRate))) return { error: "Tipo de IVA no configurado en la empresa." };
    const contact = await tx.one<{ id: string }>(`select id from contacts where id = $1`, [d.contact_id]);
    if (!contact) return { error: "El cliente no existe." };
    let quoteId = d.id || null;
    if (quoteId) {
      const cur = await tx.one<{ status: QuoteStatus }>(`select status from quotes where id = $1 for update`, [quoteId]);
      if (!cur) return { error: "El presupuesto no existe." };
      if (cur.status !== "borrador" && cur.status !== "revisado") return { error: "Solo se pueden editar borradores. Vuelve a borrador para modificarlo." };
      await tx.query(
        `update quotes set contact_id=$2, title=$3, issue_date=$4, valid_until=$5, notes=$6, next_step=$7, terms=$8,
           subtotal_cents=$9, tax_cents=$10, total_cents=$11, status='borrador', reviewed_by=null, reviewed_at=null where id=$1`,
        [quoteId, d.contact_id, d.title, d.issue_date, d.valid_until, d.notes || null, d.next_step || null, d.terms || null,
          totals.subtotalCents, totals.taxCents, totals.totalCents],
      );
      await tx.query(`delete from quote_items where quote_id = $1`, [quoteId]);
      if (cur.status === "revisado") await logActivity(tx, { contactId: d.contact_id, quoteId, userId: s.user.id, type: "presupuesto", body: "Presupuesto modificado: vuelve a borrador y requiere nueva revisión." });
    } else {
      const { number, code } = await nextQuoteCode(tx, company.quote_prefix, Number(d.issue_date.slice(0, 4)));
      const row = await tx.one<{ id: string }>(
        `insert into quotes(company_id, contact_id, number, code, title, issue_date, valid_until, notes, next_step, terms,
           subtotal_cents, tax_cents, total_cents, created_by)
         values (app_company_id(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [d.contact_id, number, code, d.title, d.issue_date, d.valid_until, d.notes || null, d.next_step || null, d.terms || null,
          totals.subtotalCents, totals.taxCents, totals.totalCents, s.user.id],
      );
      quoteId = row!.id;
      await logActivity(tx, { contactId: d.contact_id, quoteId, userId: s.user.id, type: "presupuesto", body: `Borrador de presupuesto ${code} creado.` });
    }
    for (const [pos, it] of items.entries()) {
      await tx.query(
        `insert into quote_items(company_id, quote_id, position, description, quantity, unit, unit_price_cents, discount_pct, tax_rate, line_net_cents)
         values (app_company_id(), $1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [quoteId, pos, it.description, it.quantity, it.unit, it.unitPriceCents, it.discountPct, it.taxRate, totals.lines[pos]],
      );
    }
    return { id: quoteId, created: !d.id };
  });
  if ("error" in res) return { error: res.error };
  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${res.id}?aviso=${res.created ? "presupuesto_creado" : "presupuesto_guardado"}`);
}

const statusForm = z.object({ id: z.string().uuid(), to: z.string().refine(isQuoteStatus), move_contact: z.string().optional() });

export async function setQuoteStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("quotes.write");
  const parsed = statusForm.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Datos no válidos." };
  const to = parsed.data.to as QuoteStatus;
  if (to === "revisado" && !can(s.user.role, "quotes.review")) {
    return { error: "Solo un administrador o el propietario puede dar un presupuesto por revisado." };
  }
  const res = await tenant(s, async (tx) => {
    const q = await tx.one<{ status: QuoteStatus; contact_id: string; code: string; subtotal_cents: string; item_count: number }>(
      `select q.status, q.contact_id, q.code, q.subtotal_cents, (select count(*)::int from quote_items i where i.quote_id = q.id) as item_count
         from quotes q where q.id = $1 for update`, [parsed.data.id]);
    if (!q) return { error: "El presupuesto no existe." };
    if (!canTransitionQuote(q.status, to)) {
      return { error: q.status === "borrador" && to === "enviado" ? "Antes de enviarlo, el presupuesto debe quedar revisado." : `No se puede pasar de «${QUOTE_STATUS[q.status].label}» a «${QUOTE_STATUS[to].label}».` };
    }
    if (to === "revisado" && q.item_count === 0) return { error: "El presupuesto no tiene líneas." };
    const sets: Record<QuoteStatus, string> = {
      borrador: "reviewed_by = null, reviewed_at = null, sent_at = null, decided_at = null",
      revisado: "reviewed_by = $2, reviewed_at = now()",
      enviado: "sent_at = now()",
      aceptado: "decided_at = now()",
      rechazado: "decided_at = now()",
      caducado: "decided_at = now()",
    };
    await tx.query(`update quotes set status = '${to}', ${sets[to]} where id = $1`, to === "revisado" ? [parsed.data.id, s.user.id] : [parsed.data.id]);
    const labels: Record<QuoteStatus, string> = {
      borrador: `Presupuesto ${q.code} devuelto a borrador para modificarlo.`,
      revisado: `Presupuesto ${q.code} revisado y listo para enviar.`,
      enviado: `Presupuesto ${q.code} marcado como enviado al cliente.`,
      aceptado: `Presupuesto ${q.code} aceptado por el cliente.`,
      rechazado: `Presupuesto ${q.code} rechazado por el cliente.`,
      caducado: `Presupuesto ${q.code} caducado sin respuesta.`,
    };
    await logActivity(tx, { contactId: q.contact_id, quoteId: parsed.data.id, userId: s.user.id, type: "presupuesto", body: labels[to], meta: { status: to } });
    // Sincroniza la fase de la oportunidad (automatización «Mover la ficha de fase sola»).
    await onQuoteStatus(tx, parsed.data.id, to, s.user.id);
    return { contactId: q.contact_id };
  });
  if ("error" in res) return { error: res.error };
  revalidatePath(`/presupuestos/${parsed.data.id}`);
  revalidatePath("/presupuestos");
  revalidatePath(`/contactos/${res.contactId}`);
  revalidatePath("/panel");
  return { ok: true, message: `Estado actualizado: ${QUOTE_STATUS[to].label}.` };
}

export async function duplicateQuote(fd: FormData) {
  const s = await requireCapability("quotes.write");
  const id = z.string().uuid().parse(fd.get("id"));
  const newId = await tenant(s, async (tx) => {
    const company = await getCompany(tx);
    const q = await tx.one<{ contact_id: string; title: string; notes: string | null; terms: string | null; next_step: string | null; subtotal_cents: string; tax_cents: string; total_cents: string }>(
      `select contact_id, title, notes, terms, next_step, subtotal_cents, tax_cents, total_cents from quotes where id = $1`, [id]);
    if (!q) throw new Error("No encontrado");
    const today = new Date().toISOString().slice(0, 10);
    const { number, code } = await nextQuoteCode(tx, company.quote_prefix, Number(today.slice(0, 4)));
    const row = await tx.one<{ id: string }>(
      `insert into quotes(company_id, contact_id, number, code, title, issue_date, valid_until, notes, next_step, terms, subtotal_cents, tax_cents, total_cents, created_by)
       values (app_company_id(), $1,$2,$3,$4,$5::date,$5::date + $6::int,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [q.contact_id, number, code, q.title, today, company.quote_validity_days, q.notes, q.next_step, q.terms, q.subtotal_cents, q.tax_cents, q.total_cents, s.user.id]);
    await tx.query(
      `insert into quote_items(company_id, quote_id, position, description, quantity, unit, unit_price_cents, discount_pct, tax_rate, line_net_cents)
       select company_id, $2, position, description, quantity, unit, unit_price_cents, discount_pct, tax_rate, line_net_cents from quote_items where quote_id = $1`,
      [id, row!.id]);
    await logActivity(tx, { contactId: q.contact_id, quoteId: row!.id, userId: s.user.id, type: "presupuesto", body: `Borrador ${code} creado a partir de otro presupuesto.` });
    return row!.id;
  });
  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${newId}?aviso=presupuesto_creado`);
}

export async function deleteQuote(fd: FormData) {
  const s = await requireCapability("quotes.write");
  const id = z.string().uuid().parse(fd.get("id"));
  const contactId = await tenant(s, async (tx) => {
    const q = await tx.one<{ status: string; contact_id: string; code: string }>(`select status, contact_id, code from quotes where id = $1`, [id]);
    if (!q) return null;
    if (q.status !== "borrador" && !can(s.user.role, "settings.manage")) throw new ForbiddenError("Solo se pueden eliminar borradores.");
    await tx.query(`delete from quotes where id = $1`, [id]);
    await logActivity(tx, { contactId: q.contact_id, userId: s.user.id, type: "presupuesto", body: `Presupuesto ${q.code} eliminado.` });
    await audit(tx, s, "presupuesto.eliminar", "quote", id, { code: q.code });
    return q.contact_id;
  });
  revalidatePath("/presupuestos");
  redirect(contactId ? `/contactos/${contactId}?aviso=eliminado` : "/presupuestos");
}

// ---------------------------------------------------------------------------
// Envío al cliente por email con enlace para aceptar
// ---------------------------------------------------------------------------
const sendForm = z.object({ id: z.string().uuid(), to: z.string().trim().max(200).optional() });

export async function sendQuoteEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("quotes.write");
  const parsed = sendForm.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Datos no válidos." };
  const res = await tenant(s, (tx) => sendQuoteByEmail(tx, parsed.data.id, s.user.id, parsed.data.to || null));
  if ("error" in res) return { error: res.error };
  const out = await processOutbox({ companyId: s.company.id, limit: 5 }).catch(() => null);
  revalidatePath(`/presupuestos/${parsed.data.id}`);
  revalidatePath("/presupuestos");
  revalidatePath("/panel");
  if (out && out.notConfigured) return { ok: true, message: `Preparado para ${res.to}, pero no ha salido: falta conectar el correo de envío en Ajustes › Correo de envío. Puedes copiar el enlace y mandarlo por WhatsApp.` };
  return { ok: true, message: `Enviado a ${res.to}. Cuando lo acepte, la ficha pasará sola a «Ganado» y te avisaremos.` };
}

/** Crea el enlace del cliente sin enviar email (para mandarlo por WhatsApp). Si estaba revisado, pasa a enviado. */
export async function createQuoteLink(fd: FormData) {
  const s = await requireCapability("quotes.write");
  const id = z.string().uuid().parse(fd.get("id"));
  await tenant(s, async (tx) => {
    const q = await tx.one<{ status: string; code: string; contact_id: string }>(`select status, code, contact_id from quotes where id = $1 for update`, [id]);
    if (!q || (q.status !== "revisado" && q.status !== "enviado")) return;
    await ensureQuoteToken(tx, id);
    if (q.status === "revisado") {
      await tx.query(`update quotes set status = 'enviado', sent_at = now() where id = $1`, [id]);
      await logActivity(tx, { contactId: q.contact_id, quoteId: id, userId: s.user.id, type: "presupuesto", body: `Presupuesto ${q.code} enviado al cliente mediante enlace.`, meta: { status: "enviado" } });
      await onQuoteStatus(tx, id, "enviado", s.user.id);
    }
  });
  revalidatePath(`/presupuestos/${id}`);
}
