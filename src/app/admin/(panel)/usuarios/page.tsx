import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { relative } from "@/lib/dates";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { PageHeader, Sheet, EmptyState } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { QuickPassword } from "@/components/admin/quick-password";

export const metadata: Metadata = { title: "Usuarios y contraseñas" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  await requireAdmin();
  const users = await withSystem((tx) => tx.query<{ id: string; name: string; email: string; role: Role; active: boolean; must_change_password: boolean; last_login_at: string | null; company_id: string; company: string; company_active: boolean }>(
    `select u.id, u.name, u.email, u.role, u.active, u.must_change_password, u.last_login_at, c.id as company_id, c.name as company, c.active as company_active
       from users u join companies c on c.id = u.company_id
      where ($1 = '' or u.email ilike '%' || $1 || '%' or u.name ilike '%' || $1 || '%' or c.name ilike '%' || $1 || '%')
      order by c.name, u.role, u.name limit 200`, [q]));
  return (
    <>
      <PageHeader title="Usuarios y contraseñas" description="Todos los accesos de todas las empresas. Restablece una contraseña y entrégasela al cliente." />
      <Sheet>
        <form method="get" role="search" className="flex gap-2 border-b border-rule p-3 md:p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} aria-hidden />
            <label htmlFor="q" className="sr-only">Buscar</label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Email, nombre o empresa" className="pl-9" />
          </div>
          <button className={buttonClass("secondary")}>Buscar</button>
        </form>
        {users.length === 0 ? <EmptyState title="Ningún usuario coincide" /> : (
          <ul className="divide-y divide-rule">
            {users.map((u) => (
              <li key={u.id} className="grid grid-cols-1 gap-2 px-4 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:px-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{u.name}{!u.active && <Chip tint="tint-gris">Inactivo</Chip>}{u.must_change_password && <Chip tint="tint-amarilla">Temporal</Chip>}</p>
                  <p className="truncate font-mono text-[0.82rem] text-muted">{u.email}</p>
                </div>
                <div className="text-[0.86rem]">
                  <Link href={`/admin/empresas/${u.company_id}`} className="text-brand hover:underline">{u.company}</Link>{!u.company_active && <span className="text-warn"> · suspendida</span>}
                  <p className="text-[0.78rem] text-muted">{ROLE_LABELS[u.role]} · {u.last_login_at ? `entró ${relative(u.last_login_at)}` : "nunca ha entrado"}</p>
                </div>
                <div><QuickPassword userId={u.id} appUrl={env.appUrl} /></div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
