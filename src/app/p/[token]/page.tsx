/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Phone, Mail } from "lucide-react";
import { brandStyle } from "@/lib/brand";
import { formatCents } from "@/lib/money";
import { fmtDate, fmtDateTime, todayMadrid } from "@/lib/dates";
import { getPublicQuote, isQuoteToken } from "@/server/quote-online";
import { QuoteDocument } from "@/components/quote-document";
import { Notice } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { QuoteDecision } from "./decision";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu presupuesto", robots: { index: false, follow: false } };

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isQuoteToken(token)) notFound();
  const data = await getPublicQuote(token);
  if (!data || data.quote.status === "borrador" || data.quote.status === "revisado") notFound();
  const { quote, items, company } = data;
  const expired = quote.status === "enviado" && quote.valid_until < todayMadrid();

  return (
    <main style={brandStyle(company.brand_color)} className="min-h-dvh bg-paper px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {company.has_logo ? <img src={`/api/public/logo/${company.slug}`} alt={company.name} className="max-h-12 max-w-44 object-contain" /> : <p className="text-lg font-semibold">{company.name}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem] text-ink-2">
            {company.phone && <a href={`tel:${company.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="size-4" strokeWidth={1.75} aria-hidden />{company.phone}</a>}
            {company.email && <a href={`mailto:${company.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-4" strokeWidth={1.75} aria-hidden />{company.email}</a>}
          </div>
        </header>
        {company.is_demo && <p className="tint-amarilla tint-chip mb-4 rounded-md px-3 py-2 text-[0.82rem]">Presupuesto de demostración de una empresa ficticia.</p>}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="order-2 min-w-0 lg:order-1"><QuoteDocument quote={quote} items={items} company={company} /></div>
          <aside className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2">
            <div className="rounded-lg bg-sheet p-5 shadow-sheet ring-1 ring-rule">
              <p className="text-[0.85rem] text-muted">Presupuesto <span className="folio">{quote.code}</span></p>
              <p className="mt-1 text-[1.9rem] leading-tight font-semibold tracking-[-0.02em] num">{formatCents(quote.total_cents)}</p>
              <p className="text-[0.82rem] text-muted">IVA incluido · válido hasta el {fmtDate(quote.valid_until)}</p>
              <div className="mt-5">
                {quote.status === "aceptado" && <Notice kind="ok" title="Aceptado">Lo aceptaste el {fmtDateTime(quote.decided_at)}. La empresa se pondrá en contacto contigo.</Notice>}
                {quote.status === "rechazado" && <Notice kind="info" title="Rechazado">Nos indicaste el {fmtDateTime(quote.decided_at)} que no te interesa. Si cambias de idea, llámanos.</Notice>}
                {(quote.status === "caducado" || expired) && <Notice kind="warn" title="Ya no está vigente">La validez de este presupuesto terminó. Contacta con {company.name} para que te lo actualicen.</Notice>}
                {quote.status === "enviado" && !expired && <QuoteDecision token={token} total={formatCents(quote.total_cents)} />}
              </div>
            </div>
            <a href={`/api/public/quote/${token}/pdf`} className={buttonClass("secondary", "md", "w-full")}><Download className="size-4" strokeWidth={1.75} aria-hidden />Descargar en PDF</a>
          </aside>
        </div>
        <p className="mt-8 text-center text-[0.75rem] text-faint">Gestionado con Webora Studio</p>
      </div>
    </main>
  );
}
