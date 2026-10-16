import { NextResponse } from "next/server";
import { getPublicQuote, isQuoteToken } from "@/server/quote-online";
import { renderQuotePdf } from "@/server/quote-pdf";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

export const runtime = "nodejs";

/** PDF del presupuesto para el cliente (enlace público con token). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isQuoteToken(token)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!(await rateLimit(`quote-pdf:${await clientIp()}`, 30, 3600))) return NextResponse.json({ error: "Demasiadas descargas" }, { status: 429 });
  const data = await getPublicQuote(token);
  if (!data || data.quote.status === "borrador" || data.quote.status === "revisado") return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const buf = await renderQuotePdf({ quote: data.quote, items: data.items, company: data.company, logo: data.logo });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.quote.code}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
