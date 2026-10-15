import "server-only";
import type { Tx } from "@/lib/db";

export interface CompanyOverview {
  id: string; slug: string; name: string; brand_color: string; active: boolean; is_demo: boolean; plan_note: string | null; created_at: string;
  users: number; contacts: number; contacts_30: number; quotes: number; accepted_cents: string; last_login: string | null; owner_email: string | null;
}

export async function listCompanies(tx: Tx, q = ""): Promise<CompanyOverview[]> {
  return tx.query<CompanyOverview>(`
    select c.id, c.slug, c.name, c.brand_color, c.active, c.is_demo, c.plan_note, c.created_at,
      (select count(*)::int from users u where u.company_id = c.id and u.active) as users,
      (select count(*)::int from contacts x where x.company_id = c.id) as contacts,
      (select count(*)::int from contacts x where x.company_id = c.id and x.created_at > now() - interval '30 days') as contacts_30,
      (select count(*)::int from quotes x where x.company_id = c.id) as quotes,
      (select coalesce(sum(subtotal_cents),0) from quotes x where x.company_id = c.id and x.status = 'aceptado') as accepted_cents,
      (select max(last_login_at) from users u where u.company_id = c.id) as last_login,
      (select email from users u where u.company_id = c.id and u.role = 'propietario' order by created_at limit 1) as owner_email
    from companies c
    where ($1 = '' or c.name ilike '%' || $1 || '%' or c.slug ilike '%' || $1 || '%')
    order by c.active desc, c.created_at desc`, [q.trim().slice(0, 80)]);
}
