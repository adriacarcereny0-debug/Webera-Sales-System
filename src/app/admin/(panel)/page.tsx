import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { listCompanies } from "@/server/platform";
import { formatCents } from "@/lib/money";
import { relative } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ACTION_LABELS } from "./labels";

export const metadata: Metadata = { title: "Resumen" };

export default async function AdminHome() {
  const s = await requireAdmin();
  const { companies, leads, totals, audit } = await withSystem(async (tx) => ({
    companies: await listCompanies(tx),
    leads: await tx.query<{ id: string; name: string; company: string; city: string | null; created_at: string }>(
      `select id, name, company, city, created_at from platform_leads where status = 'nueva' order by created_at desc limit 5`),
    totals: (await tx.one<{ users: number; logins_7: number; contacts_30: number; quotes_30: number }>(`
      select (select count(*)::int from users where active) as users,
             (select count(*)::int from users where last_login_at > now() - interval '7 days') as logins_7,
             (select count(*)::int from contacts where created_at > now() - interval '30 days') as contacts_30,
             (select count(*)::int from quotes where created_at > now() - interval '30 days') as quotes_30`))!,
    audit: await tx.query<{ action: string; target: string | null; created_at: string; admin: string | null; company: string | null }>(`
      select a.action, a.target, a.created_at, p.name as admin, c.name as company from platform_audit a
        left join platform_admins p on p.id = a.admin_id left join companies c on c.id = a.company_id order by a.created_at desc limit 8`),
  }));
  const active = companies.filter((c) => c.active && !c.is_demo);
  const stats = [
    { label: "Empresas clientes activas", value: active.length, note: `${companies.filter((c) => !c.active).length} suspendidas · ${companies.filter((c) => c.is_demo).length} de demostración` },
    { label: "Usuarios activos", value: totals.users, note: `${totals.logins_7} han entrado en los últimos 7 días` },
    { label: "Solicitudes registradas", value: totals.contacts_30, note: "en todas las empresas, últimos 30 días" },
    { label: "Presupuestos creados", value: totals.quotes_30, note: "en todas las empresas, últimos 30 días" },
  ];
  return (
    <>
      <PageHeader title={`Hola, ${s.admin.name.split(" ")[0]}`} description="Estado de todas las empresas que usan Webera Sales System."
        actions={<ButtonLink href="/admin/empresas/nueva" variant="primary"><Plus className="size-4" strokeWidth={2} aria-hidden />Alta de cliente</ButtonLink>} />
      {leads.length > 0 && (
        <Sheet className="mb-6">
          <SheetHeader title={`Solicitudes de demostración nuevas (${leads.length === 5 ? "5+" : leads.length})`}
            actions={<Link href="/admin/solicitudes" className="text-[0.84rem] text-brand hover:underline">Ver todas</Link>} />
          <ul className="divide-y divide-rule">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-5">
                <span className="min-w-0 text-[0.88rem]"><span className="font-medium">{l.company}</span> · {l.name}{l.city && ` · ${l.city}`}
                  <span className="ml-2 text-[0.78rem] text-muted">{relative(l.created_at)}</span></span>
                <Link href={`/admin/empresas/nueva?solicitud=${l.id}`} className="text-[0.84rem] font-medium text-brand hover:underline">Dar de alta</Link>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      <section aria-label="Indicadores" className="mb-6 overflow-hidden rounded-lg bg-sheet shadow-sheet ring-1 ring-rule">
        <ul className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((x) => (
            <li key={x.label} className="border-r border-b border-dashed border-rule-strong px-5 py-4">
              <p className="text-[0.84rem] text-muted">{x.label}</p>
              <p className="num mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.01em]">{x.value}</p>
              <p className="mt-1 text-[0.78rem] text-muted">{x.note}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Sheet>
          <SheetHeader title="Empresas" actions={<Link href="/admin/empresas" className="text-[0.84rem] text-brand hover:underline">Ver todas</Link>} />
          {companies.length === 0 ? <EmptyState title="Aún no hay empresas" action={<ButtonLink href="/admin/empresas/nueva" variant="primary">Dar de alta la primera</ButtonLink>} /> : (
            <ul className="divide-y divide-rule">
              {companies.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/empresas/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper md:px-5">
                    <span className="size-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: c.brand_color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate font-medium">{c.name}</span>
                        {c.is_demo && <Chip tint="tint-amarilla">Demo</Chip>}{!c.active && <Chip tint="tint-gris">Suspendida</Chip>}</span>
                      <span className="block truncate text-[0.78rem] text-muted">{c.users} usuarios · {c.contacts} contactos · {c.contacts_30} este mes</span>
                    </span>
                    <span className="hidden text-right text-[0.78rem] text-muted sm:block">
                      <span className="num block text-[0.86rem] text-ink">{formatCents(c.accepted_cents, { compact: true })}</span>aceptado
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
        <Sheet>
          <SheetHeader title="Últimos movimientos" actions={<Link href="/admin/actividad" className="text-[0.84rem] text-brand hover:underline">Registro</Link>} />
          {audit.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Sin movimientos todavía.</p> : (
            <ul className="divide-y divide-rule">
              {audit.map((a, i) => (
                <li key={i} className="px-4 py-2.5 text-[0.86rem] md:px-5">
                  <p><span className="font-medium">{a.admin ?? "—"}</span> · {ACTION_LABELS[a.action] ?? a.action}</p>
                  <p className="truncate text-[0.76rem] text-muted">{[a.company, a.target].filter(Boolean).join(" · ")} · {relative(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      </div>
    </>
  );
}
