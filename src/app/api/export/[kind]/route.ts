import { NextResponse } from "next/server";
import { getSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { SOURCES, STAGE_META, QUOTE_STATUS, type Stage, type QuoteStatus, type Source } from "@/lib/stages";
import { padFolio } from "@/lib/brand";

export const runtime = "nodejs";

const euros = (c: string | number | null) => (c === null || c === undefined ? "" : (Number(c) / 100).toFixed(2).replace(".", ","));

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!can(s.user.role, "data.export")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { kind } = await params;
  const date = new Date().toISOString().slice(0, 10);

  if (kind === "contactos.csv") {
    const rows = await tenant(s, async (tx) => {
      const r = await tx.query<Record<string, string | null>>(
        `select c.folio, c.name, c.company_name, c.phone, c.email, c.address, c.postal_code, c.city, s.name as service, c.source, c.stage,
                u.name as owner, c.estimated_amount_cents, c.next_action, c.next_action_at, c.lost_reason, c.description, c.created_at, c.consent_at, c.is_demo
           from contacts c left join services s on s.id = c.service_id left join users u on u.id = c.owner_id order by c.folio`);
      await audit(tx, s, "exportar", "contact", null, { kind, rows: r.length });
      return r;
    });
    const csv = toCsv(
      ["Nº", "Nombre", "Empresa", "Teléfono", "Email", "Dirección", "CP", "Localidad", "Instalación", "Origen", "Fase", "Responsable",
        "Importe estimado (sin IVA)", "Próxima acción", "Fecha próxima acción", "Motivo pérdida", "Descripción", "Fecha de entrada", "Consentimiento web", "Demo"],
      rows.map((r) => [padFolio(r.folio!), r.name, r.company_name, r.phone, r.email, r.address, r.postal_code, r.city, r.service,
        SOURCES[r.source as Source] ?? r.source, STAGE_META[r.stage as Stage]?.label ?? r.stage, r.owner, euros(r.estimated_amount_cents),
        r.next_action, r.next_action_at, r.lost_reason, r.description, r.created_at, r.consent_at, r.is_demo ? "sí" : ""]));
    return file(csv, `contactos-${date}.csv`, "text/csv; charset=utf-8");
  }

  if (kind === "presupuestos.csv") {
    const rows = await tenant(s, async (tx) => {
      const r = await tx.query<Record<string, string | null>>(
        `select q.code, c.name as client, c.folio, q.title, q.status, q.issue_date, q.valid_until, q.subtotal_cents, q.tax_cents, q.total_cents,
                q.sent_at, q.decided_at, r.name as reviewer, q.is_demo
           from quotes q join contacts c on c.id = q.contact_id left join users r on r.id = q.reviewed_by order by q.issue_date, q.number`);
      await audit(tx, s, "exportar", "quote", null, { kind, rows: r.length });
      return r;
    });
    const csv = toCsv(
      ["Número", "Cliente", "Nº cliente", "Título", "Estado", "Fecha", "Válido hasta", "Base imponible", "IVA", "Total", "Enviado", "Decisión", "Revisado por", "Demo"],
      rows.map((r) => [r.code, r.client, padFolio(r.folio!), r.title, QUOTE_STATUS[r.status as QuoteStatus]?.label ?? r.status, r.issue_date, r.valid_until,
        euros(r.subtotal_cents), euros(r.tax_cents), euros(r.total_cents), r.sent_at, r.decided_at, r.reviewer, r.is_demo ? "sí" : ""]));
    return file(csv, `presupuestos-${date}.csv`, "text/csv; charset=utf-8");
  }

  if (kind === "completo.json") {
    if (s.user.role !== "propietario") return NextResponse.json({ error: "Solo el propietario puede exportar la copia completa" }, { status: 403 });
    const data = await tenant(s, async (tx) => {
      const tables = ["services", "contacts", "stage_history", "quotes", "quote_items", "tasks", "activities", "email_templates", "automations", "automation_runs", "email_outbox", "audit_log"];
      const out: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        company: await tx.one(`select id, slug, name, legal_name, tax_id, email, phone, website, address, city, postal_code, province, schedule, brand_color,
          quote_prefix, quote_validity_days, quote_terms, quote_footer, default_tax_rate, tax_rates, privacy_url, privacy_controller, form_enabled,
          form_photos_enabled, form_intro, form_thanks, notification_emails, custom_fields, created_at from companies where id = app_company_id()`),
        users: await tx.query(`select id, email, name, role, active, created_at, last_login_at from users`),
      };
      for (const t of tables) out[t] = await tx.query(`select * from ${t}`);
      out.attachments = await tx.query(`select id, contact_id, filename, mime, size_bytes, created_at from attachments`);
      await audit(tx, s, "exportar", "company", s.company.id, { kind });
      return out;
    });
    return file(JSON.stringify(data, null, 2), `copia-completa-${date}.json`, "application/json; charset=utf-8");
  }

  return NextResponse.json({ error: "Exportación desconocida" }, { status: 404 });
}

function file(body: string, name: string, type: string) {
  return new NextResponse(body, {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
