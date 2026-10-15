import { NextResponse } from "next/server";
import { getSession, tenant } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Foto adjunta a una solicitud. Solo accesible con sesión y dentro de la propia empresa (RLS). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const row = await tenant(s, (tx) => tx.one<{ data: Buffer; mime: string; filename: string }>(`select data, mime, filename from attachments where id = $1`, [id]));
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `inline; filename="${row.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
