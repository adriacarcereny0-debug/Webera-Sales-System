import "server-only";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

// Sin partición silábica: los conceptos técnicos se leen mejor enteros.
Font.registerHyphenationCallback((word) => [word]);
import { computeQuote } from "@/lib/quotes/calc";
import { formatCents, formatDecimal } from "@/lib/money";
import { fmtDateLong } from "@/lib/dates";
import { padFolio } from "@/lib/brand";
import type { QuoteItemRow, QuoteRow } from "./quotes";
import type { CompanySettings } from "./company";

const INK = "#151b2c";
const MUTED = "#5a6378";
const RULE = "#d9dde5";
const FOLIO = "#c22d29";

const st = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9, color: INK, lineHeight: 1.35 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  small: { fontSize: 8, color: MUTED },
  label: { fontSize: 7, color: MUTED, letterSpacing: 1, textTransform: "uppercase" },
  code: { fontSize: 18, color: FOLIO, fontFamily: "Helvetica-Bold", marginTop: 2, marginBottom: 6, lineHeight: 1.2 },
  perforation: { borderBottomWidth: 1, borderBottomColor: RULE, borderBottomStyle: "dashed", marginVertical: 14 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 5 },
  td: { paddingVertical: 5 },
  tableHead: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: INK },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: RULE },
  right: { textAlign: "right" },
  footer: { position: "absolute", top: 806, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
  watermark: { position: "absolute", top: 330, left: 70, fontSize: 92, color: "#c22d29", opacity: 0.08, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

export async function renderQuotePdf(opts: { quote: QuoteRow; items: QuoteItemRow[]; company: CompanySettings; logo: { data: Buffer; mime: string } | null }) {
  const { quote, items, company, logo } = opts;
  const totals = computeQuote(items.map((i) => ({ quantity: Number(i.quantity), unitPriceCents: Number(i.unit_price_cents), discountPct: Number(i.discount_pct), taxRate: Number(i.tax_rate) })));
  const showDiscount = items.some((i) => Number(i.discount_pct) > 0);
  const cols = showDiscount ? [0.46, 0.11, 0.13, 0.08, 0.08, 0.14] : [0.52, 0.12, 0.14, 0.08, 0.14];
  const logoSrc = logo && (logo.mime === "image/png" || logo.mime === "image/jpeg") ? `data:${logo.mime};base64,${logo.data.toString("base64")}` : null;
  const date = (d: string) => fmtDateLong(d + "T12:00:00Z");

  const doc = (
    <Document title={`Presupuesto ${quote.code}`} author={company.name} creator="Webera Sales System" language="es">
      <Page size="A4" style={st.page}>
        <View style={[st.bar, { backgroundColor: company.brand_color }]} fixed />
        {quote.status === "borrador" && <Text style={st.watermark} fixed>BORRADOR</Text>}

        <View style={st.between}>
          <View style={{ maxWidth: 300 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no es <img> */}
            {logoSrc ? <Image src={logoSrc} style={{ maxHeight: 46, maxWidth: 170, objectFit: "contain", marginBottom: 6 }} /> : <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{company.name}</Text>}
            {company.legal_name && <Text style={st.small}>{company.legal_name}{company.tax_id ? ` · NIF ${company.tax_id}` : ""}</Text>}
            {(company.address || company.city) && <Text style={st.small}>{[company.address, [company.postal_code, company.city].filter(Boolean).join(" "), company.province].filter(Boolean).join(", ")}</Text>}
            <Text style={st.small}>{[company.phone, company.email, company.website].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={st.label}>Presupuesto</Text>
            <Text style={st.code}>{quote.code}</Text>
            <Text style={st.small}>Fecha: {date(quote.issue_date)}</Text>
            <Text style={st.small}>Válido hasta: {date(quote.valid_until)}</Text>
          </View>
        </View>

        <View style={st.perforation} />

        <Text style={st.label}>Cliente</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 2 }}>{quote.contact_name}</Text>
        {quote.contact_company && <Text>{quote.contact_company}</Text>}
        {(quote.contact_address || quote.contact_city) && <Text>{[quote.contact_address, [quote.contact_postal_code, quote.contact_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</Text>}
        <Text style={st.small}>{[quote.contact_phone, quote.contact_email].filter(Boolean).join(" · ")}</Text>
        <Text style={[st.small, { marginTop: 2 }]}>Ref. cliente Nº {padFolio(quote.contact_folio)}</Text>

        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8 }}>{quote.title}</Text>

        <View style={st.tableHead} fixed>
          <Text style={[st.th, { width: `${cols[0] * 100}%` }]}>Concepto</Text>
          <Text style={[st.th, st.right, { width: `${cols[1] * 100}%` }]}>Cant.</Text>
          <Text style={[st.th, st.right, { width: `${cols[2] * 100}%` }]}>Precio</Text>
          {showDiscount && <Text style={[st.th, st.right, { width: `${cols[3] * 100}%` }]}>Dto.</Text>}
          <Text style={[st.th, st.right, { width: `${cols[showDiscount ? 4 : 3] * 100}%` }]}>IVA</Text>
          <Text style={[st.th, st.right, { width: `${cols[showDiscount ? 5 : 4] * 100}%` }]}>Importe</Text>
        </View>
        {items.map((it, i) => (
          <View key={it.id} style={st.tableRow} wrap={false}>
            <Text style={[st.td, { width: `${cols[0] * 100}%`, paddingRight: 8 }]}>{it.description}</Text>
            <Text style={[st.td, st.right, { width: `${cols[1] * 100}%` }]}>{formatDecimal(it.quantity)} {it.unit}</Text>
            <Text style={[st.td, st.right, { width: `${cols[2] * 100}%` }]}>{formatCents(it.unit_price_cents)}</Text>
            {showDiscount && <Text style={[st.td, st.right, { width: `${cols[3] * 100}%` }]}>{Number(it.discount_pct) ? `${formatDecimal(it.discount_pct, 2)} %` : "-"}</Text>}
            <Text style={[st.td, st.right, { width: `${cols[showDiscount ? 4 : 3] * 100}%` }]}>{formatDecimal(it.tax_rate, 2)} %</Text>
            <Text style={[st.td, st.right, { width: `${cols[showDiscount ? 5 : 4] * 100}%` }]}>{formatCents(totals.lines[i])}</Text>
          </View>
        ))}

        <View style={{ alignSelf: "flex-end", width: 210, marginTop: 12 }} wrap={false}>
          <View style={[st.between, { paddingVertical: 2 }]}><Text style={{ color: MUTED }}>Base imponible</Text><Text>{formatCents(totals.subtotalCents)}</Text></View>
          {totals.breakdown.map((b) => (
            <View key={b.rate} style={[st.between, { paddingVertical: 2 }]}><Text style={{ color: MUTED }}>IVA {b.rate} % s/ {formatCents(b.baseCents)}</Text><Text>{formatCents(b.taxCents)}</Text></View>
          ))}
          <View style={[st.between, { borderTopWidth: 1.5, borderColor: INK, marginTop: 4, paddingTop: 5 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>Total</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{formatCents(totals.totalCents)}</Text>
          </View>
        </View>

        {(quote.notes || quote.terms) && (
          <View style={[st.row, { marginTop: 22, gap: 18 }]} wrap={false}>
            {quote.notes && <View style={{ flex: 1 }}><Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Observaciones</Text><Text style={{ color: MUTED }}>{quote.notes}</Text></View>}
            {quote.terms && <View style={{ flex: 1 }}><Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Condiciones</Text><Text style={{ color: MUTED }}>{quote.terms}</Text></View>}
          </View>
        )}

        <View style={{ marginTop: 28, flexDirection: "row", gap: 24 }} wrap={false}>
          <View style={{ flex: 1, borderTopWidth: 0.5, borderColor: MUTED, paddingTop: 4 }}><Text style={st.small}>Conforme, el cliente (firma y fecha)</Text></View>
          <View style={{ flex: 1, borderTopWidth: 0.5, borderColor: MUTED, paddingTop: 4 }}><Text style={st.small}>Por {company.name}</Text></View>
        </View>

        <View style={st.footer} fixed>
          <Text>{company.quote_footer ?? company.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `${quote.code} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
