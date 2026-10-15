import "server-only";
import type { Tx } from "@/lib/db";
import { padFolio } from "@/lib/brand";

export async function editorContacts(tx: Tx, includeId?: string) {
  const rows = await tx.query<{ id: string; folio: string; name: string; city: string | null }>(
    `select id, folio, name, city from contacts where stage <> 'perdido' or id = $1 order by name limit 1000`, [includeId ?? null]);
  return rows.map((c) => ({ id: c.id, label: `${c.name}${c.city ? ` · ${c.city}` : ""} · Nº ${padFolio(c.folio)}` }));
}
