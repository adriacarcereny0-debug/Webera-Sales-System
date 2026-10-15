import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AUDIT_LABELS } from "@/lib/audit";
import { fmtDateTime } from "@/lib/dates";
import { Sheet, SheetHeader, EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Historial de actividad" };
const PAGE = 40;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const s = await requireSession();
  if (!can(s.user.role, "audit.view")) redirect("/ajustes?aviso=sin_permiso");
  const { rows, total } = await tenant(s, async (tx) => ({
    rows: await tx.query<{ action: string; detail: Record<string, unknown>; created_at: string; user_name: string | null }>(
      `select a.action, a.detail, a.created_at, u.name as user_name from audit_log a left join users u on u.id = a.user_id
        order by a.created_at desc limit ${PAGE} offset ${(page - 1) * PAGE}`),
    total: (await tx.one<{ n: number }>(`select count(*)::int as n from audit_log`))?.n ?? 0,
  }));
  const describe = (d: Record<string, unknown>) =>
    Object.entries(d).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => `${k}: ${v}`).join(" · ");
  return (
    <Sheet>
      <SheetHeader title="Historial de administración" description="Cambios de configuración, usuarios, importaciones, exportaciones y eliminaciones." />
      {rows.length === 0 ? <EmptyState title="Sin actividad registrada" /> : (
        <ul className="divide-y divide-rule">
          {rows.map((r, i) => (
            <li key={i} className="grid-cols-1 grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] md:px-5">
              <time className="text-[0.8rem] text-muted" dateTime={r.created_at}>{fmtDateTime(r.created_at)}</time>
              <div className="min-w-0 text-[0.88rem]">
                <p><span className="font-medium">{r.user_name ?? "Sistema"}</span> · {AUDIT_LABELS[r.action] ?? r.action}</p>
                {describe(r.detail) && <p className="truncate text-[0.78rem] text-muted">{describe(r.detail)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE} total={total} hrefFor={(p) => `/ajustes/actividad?pagina=${p}`} />
    </Sheet>
  );
}
