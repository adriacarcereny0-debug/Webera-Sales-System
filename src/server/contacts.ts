import "server-only";
import type { Tx } from "@/lib/db";
import { isSource, isStage, type Source, type Stage } from "@/lib/stages";

export interface ContactRow {
  id: string;
  folio: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  service_id: string | null;
  service_name: string | null;
  source: Source;
  owner_id: string | null;
  owner_name: string | null;
  estimated_amount_cents: string | null;
  stage: Stage;
  stage_changed_at: string;
  lost_reason: string | null;
  next_action: string | null;
  next_action_at: string | null;
  timeframe: string | null;
  description: string | null;
  consent_at: string | null;
  custom_values: Record<string, unknown>;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  select c.*, s.name as service_name, u.name as owner_name
    from contacts c
    left join services s on s.id = c.service_id
    left join users u on u.id = c.owner_id`;

export const SORTS = {
  recientes: "c.created_at desc",
  antiguos: "c.created_at asc",
  nombre: "c.name asc",
  importe: "c.estimated_amount_cents desc nulls last",
  proxima: "c.next_action_at asc nulls last",
  folio: "c.folio desc",
} as const;
export type SortKey = keyof typeof SORTS;

export interface ContactFilters {
  q?: string;
  stage?: string;
  owner?: string;
  service?: string;
  source?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export async function listContacts(tx: Tx, f: ContactFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.q && f.q.trim()) {
    const q = f.q.trim().slice(0, 100);
    const digits = q.replace(/\D/g, "");
    params.push(`%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`);
    const p = `$${params.length}`;
    const ors = [`c.name ilike ${p}`, `c.company_name ilike ${p}`, `c.email ilike ${p}`, `c.city ilike ${p}`, `c.postal_code ilike ${p}`];
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      ors.push(`regexp_replace(coalesce(c.phone,''), '\\D', '', 'g') like $${params.length}`);
      if (digits.length <= 9) {
        params.push(Number(digits));
        ors.push(`c.folio = $${params.length}`);
      }
    }
    where.push(`(${ors.join(" or ")})`);
  }
  if (f.stage === "abiertos") where.push(`c.stage not in ('ganado','perdido')`);
  else if (isStage(f.stage)) add("c.stage = ?", f.stage);
  if (f.owner === "sin") where.push("c.owner_id is null");
  else if (f.owner && /^[0-9a-f-]{36}$/.test(f.owner)) add("c.owner_id = ?", f.owner);
  if (f.service && /^[0-9a-f-]{36}$/.test(f.service)) add("c.service_id = ?", f.service);
  if (isSource(f.source)) add("c.source = ?", f.source);

  const sort = SORTS[(f.sort as SortKey) in SORTS ? (f.sort as SortKey) : "recientes"];
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 5), 100);
  const page = Math.max(1, f.page ?? 1);
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const total = await tx.one<{ n: number }>(`select count(*)::int as n from contacts c ${whereSql}`, params);
  const rows = await tx.query<ContactRow>(
    `${SELECT} ${whereSql} order by ${sort}, c.folio desc limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  return { rows, total: total?.n ?? 0, page, pageSize };
}

export async function getContact(tx: Tx, id: string): Promise<ContactRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return tx.one<ContactRow>(`${SELECT} where c.id = $1`, [id]);
}

export async function findDuplicates(tx: Tx, email: string | null, phone: string | null, excludeId?: string) {
  const digits = phone?.replace(/\D/g, "").slice(-9) ?? "";
  if (!email && digits.length < 9) return [];
  return tx.query<{ id: string; folio: string; name: string }>(
    `select id, folio, name from contacts
      where ($3::uuid is null or id <> $3::uuid)
        and ((($1::text) is not null and lower(email) = lower($1::text))
          or (length($2::text) = 9 and right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 9) = $2::text))
      limit 3`,
    [email, digits, excludeId ?? null],
  );
}

export async function listUsers(tx: Tx, onlyActive = true) {
  return tx.query<{ id: string; name: string; role: string; email: string; active: boolean }>(
    `select id, name, role, email, active from users ${onlyActive ? "where active" : ""} order by name`,
  );
}

export async function listServices(tx: Tx, onlyActive = true) {
  return tx.query<{ id: string; name: string; description: string | null; active: boolean; sort: number }>(
    `select id, name, description, active, sort from services ${onlyActive ? "where active" : ""} order by sort, name`,
  );
}

export async function changeStage(tx: Tx, contactId: string, to: Stage, userId: string | null, note: string | null, lostReason: string | null) {
  const cur = await tx.one<{ stage: Stage }>(`select stage from contacts where id = $1 for update`, [contactId]);
  if (!cur) throw new Error("Contacto no encontrado");
  if (cur.stage === to) return false;
  await tx.query(
    `update contacts set stage = $2, stage_changed_at = now(), lost_reason = case when $2 = 'perdido' then $3 else null end where id = $1`,
    [contactId, to, lostReason],
  );
  await tx.query(
    `insert into stage_history(company_id, contact_id, from_stage, to_stage, user_id, note) values (app_company_id(), $1, $2, $3, $4, $5)`,
    [contactId, cur.stage, to, userId, to === "perdido" ? lostReason ?? note : note],
  );
  return true;
}

export async function logActivity(
  tx: Tx,
  a: { contactId?: string | null; quoteId?: string | null; userId?: string | null; type: string; body?: string | null; meta?: Record<string, unknown> },
) {
  await tx.query(
    `insert into activities(company_id, contact_id, quote_id, user_id, type, body, meta) values (app_company_id(), $1, $2, $3, $4, $5, $6)`,
    [a.contactId ?? null, a.quoteId ?? null, a.userId ?? null, a.type, a.body ?? null, JSON.stringify(a.meta ?? {})],
  );
}
