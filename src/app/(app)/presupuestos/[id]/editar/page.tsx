import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getCompany } from "@/server/company";
import { getQuote } from "@/server/quotes";
import { centsToInput, formatDecimal } from "@/lib/money";
import { PageHeader, Notice } from "@/components/ui/misc";
import { QuoteEditor } from "../../quote-editor";
import { editorContacts } from "../../editor-data";

export const metadata: Metadata = { title: "Editar presupuesto" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  if (!can(s.user.role, "quotes.write")) redirect(`/presupuestos/${id}?aviso=sin_permiso`);
  const data = await tenant(s, async (tx) => {
    const q = await getQuote(tx, id);
    if (!q) return null;
    return { ...q, company: await getCompany(tx), contacts: await editorContacts(tx, q.quote.contact_id) };
  });
  if (!data) notFound();
  const { quote, items, company } = data;
  if (quote.status !== "borrador" && quote.status !== "revisado") redirect(`/presupuestos/${id}`);
  return (
    <>
      <PageHeader title={`Editar ${quote.code}`} />
      {quote.status === "revisado" && <Notice kind="warn" className="mb-5">Este presupuesto ya estaba revisado. Al guardar cambios volverá a borrador y necesitará una nueva revisión.</Notice>}
      <QuoteEditor
        cancelHref={`/presupuestos/${id}`}
        contacts={data.contacts}
        taxRates={[...new Set([...company.tax_rates, ...items.map((i) => Number(i.tax_rate))])]}
        defaultTax={Number(company.default_tax_rate)}
        defaults={{
          id, contact_id: quote.contact_id, title: quote.title, issue_date: quote.issue_date, valid_until: quote.valid_until,
          notes: quote.notes ?? "", next_step: quote.next_step ?? "", terms: quote.terms ?? "",
          lines: items.map((it) => ({
            key: it.id, description: it.description, quantity: formatDecimal(it.quantity).replace(/\./g, ""), unit: it.unit,
            unit_price: centsToInput(Number(it.unit_price_cents)), discount: Number(it.discount_pct) ? formatDecimal(it.discount_pct) : "",
            tax_rate: String(Number(it.tax_rate)),
          })),
        }}
      />
    </>
  );
}
