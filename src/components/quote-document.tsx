/* eslint-disable @next/next/no-img-element */
import { computeQuote } from "@/lib/quotes/calc";
import { formatCents, formatDecimal } from "@/lib/money";
import { fmtDateLong } from "@/lib/dates";
import { padFolio } from "@/lib/brand";
import type { QuoteItemRow, QuoteRow } from "@/server/quotes";
import type { CompanySettings } from "@/server/company";

/** Presupuesto como hoja de talonario: así se ve en pantalla (el PDF replica la estructura). */
export function QuoteDocument({ quote, items, company }: { quote: QuoteRow; items: QuoteItemRow[]; company: CompanySettings }) {
  const totals = computeQuote(items.map((i) => ({ quantity: Number(i.quantity), unitPriceCents: Number(i.unit_price_cents), discountPct: Number(i.discount_pct), taxRate: Number(i.tax_rate) })));
  const showDiscount = items.some((i) => Number(i.discount_pct) > 0);
  return (
    <article className="overflow-hidden rounded-lg bg-white shadow-sheet ring-1 ring-rule" aria-label={`Documento del presupuesto ${quote.code}`}>
      <div className="h-1.5 bg-brand" aria-hidden />
      <header className="flex flex-col gap-6 px-6 pt-7 pb-6 sm:flex-row sm:justify-between md:px-10">
        <div className="min-w-0">
          {company.has_logo ? (
            <img src={`/api/public/logo/${company.slug}`} alt={company.name} className="mb-3 max-h-14 max-w-48 object-contain" />
          ) : (
            <p className="mb-1 text-lg font-semibold">{company.name}</p>
          )}
          <div className="text-[0.8rem] leading-relaxed text-muted">
            {company.legal_name && <p>{company.legal_name}{company.tax_id ? ` · NIF ${company.tax_id}` : ""}</p>}
            {(company.address || company.city) && <p>{[company.address, [company.postal_code, company.city].filter(Boolean).join(" "), company.province].filter(Boolean).join(", ")}</p>}
            <p>{[company.phone, company.email, company.website].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-[0.75rem] font-medium tracking-[0.1em] text-muted uppercase">Presupuesto</p>
          <p className="folio mt-1 text-[1.6rem] leading-none">{quote.code}</p>
          <dl className="mt-3 text-[0.82rem]">
            <div className="flex gap-2 sm:justify-end"><dt className="text-muted">Fecha</dt><dd>{fmtDateLong(quote.issue_date + "T12:00:00Z")}</dd></div>
            <div className="flex gap-2 sm:justify-end"><dt className="text-muted">Válido hasta</dt><dd>{fmtDateLong(quote.valid_until + "T12:00:00Z")}</dd></div>
          </dl>
        </div>
      </header>

      <div className="perforation-x mx-6 md:mx-10" aria-hidden />

      <section className="px-6 py-6 md:px-10">
        <p className="text-[0.75rem] font-medium tracking-[0.1em] text-muted uppercase">Cliente</p>
        <p className="mt-1 font-semibold">{quote.contact_name}</p>
        <div className="text-[0.85rem] text-ink-2">
          {quote.contact_company && <p>{quote.contact_company}</p>}
          {(quote.contact_address || quote.contact_city) && <p>{[quote.contact_address, [quote.contact_postal_code, quote.contact_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>}
          <p>{[quote.contact_phone, quote.contact_email].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-[0.78rem] text-muted">Ref. cliente Nº {padFolio(quote.contact_folio)}</p>
        </div>
        <h2 className="mt-6 text-[1.05rem] font-semibold">{quote.title}</h2>
      </section>

      <div className="overflow-x-auto px-6 md:px-10">
        <table className="w-full min-w-[34rem] text-[0.85rem]">
          <thead>
            <tr className="border-y border-ink text-left text-[0.75rem] text-ink-2">
              <th scope="col" className="py-2 pr-3 font-semibold">Concepto</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Cant.</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Precio</th>
              {showDiscount && <th scope="col" className="px-2 py-2 text-right font-semibold">Dto.</th>}
              <th scope="col" className="px-2 py-2 text-right font-semibold">IVA</th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b border-rule align-top">
                <td className="py-2.5 pr-3 whitespace-pre-line">{it.description}</td>
                <td className="num px-2 py-2.5 text-right whitespace-nowrap">{formatDecimal(it.quantity)} {it.unit}</td>
                <td className="num px-2 py-2.5 text-right whitespace-nowrap">{formatCents(it.unit_price_cents)}</td>
                {showDiscount && <td className="num px-2 py-2.5 text-right">{Number(it.discount_pct) ? `${formatDecimal(it.discount_pct, 2)} %` : "—"}</td>}
                <td className="num px-2 py-2.5 text-right whitespace-nowrap">{formatDecimal(it.tax_rate, 2)} %</td>
                <td className="num py-2.5 pl-2 text-right whitespace-nowrap">{formatCents(totals.lines[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-6 py-5 md:px-10">
        <dl className="num w-full max-w-xs space-y-1 text-[0.85rem]">
          <div className="flex justify-between"><dt className="text-muted">Base imponible</dt><dd>{formatCents(totals.subtotalCents)}</dd></div>
          {totals.breakdown.map((b) => (
            <div key={b.rate} className="flex justify-between"><dt className="text-muted">IVA {b.rate} %</dt><dd>{formatCents(b.taxCents)}</dd></div>
          ))}
          <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatCents(totals.totalCents)}</dd></div>
        </dl>
      </div>

      {(quote.notes || quote.terms) && (
        <div className="grid-cols-1 grid gap-5 border-t border-rule px-6 py-5 text-[0.82rem] md:grid-cols-2 md:px-10">
          {quote.notes && <div><p className="mb-1 font-semibold">Observaciones</p><p className="whitespace-pre-line text-ink-2">{quote.notes}</p></div>}
          {quote.terms && <div><p className="mb-1 font-semibold">Condiciones</p><p className="whitespace-pre-line text-ink-2">{quote.terms}</p></div>}
        </div>
      )}
      {company.quote_footer && <p className="border-t border-rule px-6 py-3 text-[0.75rem] text-muted md:px-10">{company.quote_footer}</p>}
    </article>
  );
}
