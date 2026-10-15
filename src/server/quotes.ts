import "server-only";
import type { Tx } from "@/lib/db";
import type { QuoteStatus } from "@/lib/stages";

export interface QuoteRow {
  id: string; contact_id: string; number: string; code: string; title: string; status: QuoteStatus;
  issue_date: string; valid_until: string; notes: string | null; next_step: string | null; terms: string | null;
  subtotal_cents: string; tax_cents: string; total_cents: string; reviewed_by: string | null; reviewer_name: string | null;
  reviewed_at: string | null; sent_at: string | null; decided_at: string | null; is_demo: boolean; created_at: string; updated_at: string;
  creator_name: string | null; contact_name: string; contact_folio: string; contact_company: string | null; contact_email: string | null;
  contact_phone: string | null; contact_address: string | null; contact_city: string | null; contact_postal_code: string | null;
}

export interface QuoteItemRow {
  id: string; position: number; description: string; quantity: string; unit: string; unit_price_cents: string;
  discount_pct: string; tax_rate: string; line_net_cents: string;
}

export async function getQuote(tx: Tx, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const q = await tx.one<QuoteRow>(
    `select q.*, to_char(q.issue_date, 'YYYY-MM-DD') as issue_date, to_char(q.valid_until, 'YYYY-MM-DD') as valid_until,
            r.name as reviewer_name, cr.name as creator_name,
            c.name as contact_name, c.folio as contact_folio, c.company_name as contact_company, c.email as contact_email,
            c.phone as contact_phone, c.address as contact_address, c.city as contact_city, c.postal_code as contact_postal_code
       from quotes q join contacts c on c.id = q.contact_id
       left join users r on r.id = q.reviewed_by left join users cr on cr.id = q.created_by
      where q.id = $1`, [id]);
  if (!q) return null;
  const items = await tx.query<QuoteItemRow>(`select * from quote_items where quote_id = $1 order by position`, [id]);
  return { quote: q, items };
}

export async function nextQuoteCode(tx: Tx, prefix: string, year: number) {
  const r = await tx.one<{ n: string }>(`select next_counter(app_company_id(), $1) as n`, [`quote:${year}`]);
  const n = Number(r!.n);
  return { number: n, code: `${prefix}-${year}-${String(n).padStart(4, "0")}` };
}
