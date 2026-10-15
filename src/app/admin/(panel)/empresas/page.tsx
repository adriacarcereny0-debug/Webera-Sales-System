import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { listCompanies } from "@/server/platform";
import { formatCents } from "@/lib/money";
import { fmtDate, relative } from "@/lib/dates";
import { PageHeader, Sheet, EmptyState, Notice } from "@/components/ui/misc";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";

export const metadata: Metadata = { title: "Empresas" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; aviso?: string }> }) {
  const sp = await searchParams;
  await requireAdmin();
  const companies = await withSystem((tx) => listCompanies(tx, sp.q ?? ""));
  return (
    <>
      <PageHeader title="Empresas" description="Cada instalador cliente, con su actividad y su estado."
        actions={<ButtonLink href="/admin/empresas/nueva" variant="primary"><Plus className="size-4" strokeWidth={2} aria-hidden />Alta de cliente</ButtonLink>} />
      {sp.aviso === "eliminada" && <Notice kind="ok" className="mb-5">Empresa eliminada con todos sus datos.</Notice>}
      <Sheet>
        <form method="get" role="search" className="flex gap-2 border-b border-rule p-3 md:p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} aria-hidden />
            <label htmlFor="q" className="sr-only">Buscar empresa</label>
            <Input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Nombre o identificador" className="pl-9" />
          </div>
          <button className={buttonClass("secondary")}>Buscar</button>
        </form>
        {companies.length === 0 ? <EmptyState title="Ninguna empresa" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <caption className="sr-only">Empresas</caption>
              <thead>
                <tr className="border-b border-rule text-left text-[0.78rem] text-muted">
                  <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Empresa</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Propietario</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Usuarios</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Contactos (30 d)</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Aceptado</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Último acceso</th>
                  <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">Alta</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="relative border-b border-rule last:border-0 hover:bg-[color-mix(in_oklab,var(--brand)_4%,white)]">
                    <td className="py-3 pr-3 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="size-3 shrink-0 rounded-full" style={{ background: c.brand_color }} aria-hidden />
                        <div className="min-w-0">
                          <Link href={`/admin/empresas/${c.id}`} className="font-medium after:absolute after:inset-0 hover:underline">{c.name}</Link>
                          <p className="font-mono text-[0.76rem] text-muted">/{c.slug}</p>
                        </div>
                        {c.is_demo && <Chip tint="tint-amarilla">Demo</Chip>}
                        {!c.active && <Chip tint="tint-gris">Suspendida</Chip>}
                      </div>
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-3 text-ink-2">{c.owner_email ?? "—"}</td>
                    <td className="num px-3 py-3 text-right">{c.users}</td>
                    <td className="num px-3 py-3 text-right">{c.contacts} <span className="text-muted">({c.contacts_30})</span></td>
                    <td className="num px-3 py-3 text-right">{formatCents(c.accepted_cents, { compact: true })}</td>
                    <td className="px-3 py-3 text-ink-2">{c.last_login ? relative(c.last_login) : <span className="text-warn">Nunca</span>}</td>
                    <td className="py-3 pr-5 pl-3 text-muted">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </>
  );
}
