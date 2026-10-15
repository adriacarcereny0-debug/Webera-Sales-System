import { NextResponse } from "next/server";
import { getSession, tenant } from "@/lib/auth/session";
import { getQuote } from "@/server/quotes";
import { getCompany } from "@/server/company";
import { renderQuotePdf } from "@/server/quote-pdf";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const data = await tenant(s, async (tx) => {
    const q = await getQuote(tx, id);
    if (!q) return null;
    const company = await getCompany(tx);
    const logo = company.has_logo ? await tx.one<{ data: Buffer; mime: string }>(`select logo_data as data, logo_mime as mime from companies where id = app_company_id()`) : null;
    return { ...q, company, logo };
  });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const buf = await renderQuotePdf({ quote: data.quote, items: data.items, company: data.company, logo: data.logo });
  const name = `${data.quote.code}${data.quote.status === "borrador" ? "-BORRADOR" : ""}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
