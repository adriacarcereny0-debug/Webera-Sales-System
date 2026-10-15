import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader, Sheet, EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { ACTION_LABELS } from "../labels";

export const metadata: Metadata = { title: "Registro" };
const PAGE = 50;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  await requireAdmin();
  const { rows, total } = await withSystem(async (tx) => ({
    rows: await tx.query<{ action: string; target: string | null; created_at: string; admin: string | null; company: string | null }>(
      `select a.action, a.target, a.created_at, p.name as admin, c.name as company from platform_audit a
         left join platform_admins p on p.id = a.admin_id left join companies c on c.id = a.company_id
        order by a.created_at desc limit ${PAGE} offset ${(page - 1) * PAGE}`),
    total: (await tx.one<{ n: number }>(`select count(*)::int as n from platform_audit`))?.n ?? 0,
  }));
  return (
    <>
      <PageHeader title="Registro de la consola" description="Todo lo que hace el equipo de Webera desde aquí: altas, contraseñas, suspensiones y eliminaciones." />
      <Sheet>
        {rows.length === 0 ? <EmptyState title="Sin movimientos" /> : (
          <ul className="divide-y divide-rule">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] md:px-5">
                <time className="text-[0.8rem] text-muted" dateTime={r.created_at}>{fmtDateTime(r.created_at)}</time>
                <p className="text-[0.88rem]"><span className="font-medium">{r.admin ?? "—"}</span> {ACTION_LABELS[r.action] ?? r.action}
                  {(r.company || r.target) && <span className="text-muted"> · {[r.company, r.target].filter(Boolean).join(" · ")}</span>}</p>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} hrefFor={(p) => `/admin/actividad?pagina=${p}`} />
      </Sheet>
    </>
  );
}
