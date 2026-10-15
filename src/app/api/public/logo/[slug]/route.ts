import { NextResponse } from "next/server";
import { withSystem } from "@/lib/db";

export const runtime = "nodejs";

/** Logotipo público de la empresa (se muestra en el formulario web y la cabecera). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,50}$/.test(slug)) return new NextResponse(null, { status: 404 });
  const row = await withSystem((tx) => tx.one<{ logo_data: Buffer; logo_mime: string; updated_at: string }>(
    `select logo_data, logo_mime, updated_at from companies where slug = $1 and logo_data is not null`, [slug]));
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.logo_data), {
    headers: {
      "Content-Type": row.logo_mime,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
