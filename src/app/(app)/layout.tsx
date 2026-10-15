import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { brandStyle } from "@/lib/brand";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { logout } from "@/app/login/actions";
import { NavLinks, MobileNav } from "@/components/shell/nav";
import { CompanyMark } from "@/components/shell/company-mark";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession({ allowPasswordChange: true });
  const counts = await tenant(s, (tx) =>
    tx.one<{ overdue: number; fresh: number }>(
      `select
         (select count(*)::int from tasks where done_at is null and due_at < now()) as overdue,
         (select count(*)::int from contacts where stage = 'nuevo') as fresh`,
    ),
  );
  const badges = { "/agenda": counts?.overdue ?? 0, "/contactos": counts?.fresh ?? 0 };
  const logoUrl = s.company.hasLogo ? `/api/public/logo/${s.company.slug}` : null;

  const userBlock = (
    <div className="flex items-center gap-2">
      <Link href="/cuenta" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-white/85 hover:bg-white/8">
        <UserRound className="size-[18px] shrink-0 text-white/60" strokeWidth={1.6} aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-[0.85rem] font-medium leading-tight">{s.user.name}</span>
          <span className="block text-[0.72rem] leading-tight text-white/55">{ROLE_LABELS[s.user.role]}</span>
        </span>
      </Link>
      <form action={logout}>
        <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"
          className="inline-flex size-11 items-center justify-center rounded-md text-white/65 hover:bg-white/8 hover:text-white md:size-9">
          <LogOut className="size-[18px]" strokeWidth={1.6} />
        </button>
      </form>
    </div>
  );

  return (
    <div style={brandStyle(s.company.brandColor)} className="min-h-dvh md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-sheet focus:px-3 focus:py-2 focus:text-ink focus:shadow-lift">
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio y tablet) */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col bg-brand-ink md:flex">
        <div className="px-4 pt-5 pb-4">
          <CompanyMark name={s.company.name} logoUrl={logoUrl} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Principal">
          <NavLinks badges={badges} />
        </nav>
        <div className="border-t border-white/10 p-3">{userBlock}</div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-brand-ink px-2 md:hidden">
        <div className="min-w-0 pl-2"><CompanyMark name={s.company.name} logoUrl={logoUrl} /></div>
        <MobileNav header={<CompanyMark name={s.company.name} logoUrl={logoUrl} />} footer={userBlock} badges={badges} />
      </header>

      <div className="min-w-0">
        {s.company.isDemo && (
          <div className="no-print tint-amarilla border-b border-[var(--t-line)] bg-[var(--t-bg)] text-[var(--t-fg)]">
            <p className="mx-auto flex max-w-[84rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[0.84rem] md:px-8">
              <span className="font-semibold">Empresa de demostración.</span>
              <span>Todos los contactos, presupuestos y cifras son ficticios.</span>
              {can(s.user.role, "demo.manage") && (
                <Link href="/ajustes/datos#demo" className="font-medium underline">Restaurar la demo</Link>
              )}
            </p>
          </div>
        )}
        <main id="contenido" className="mx-auto max-w-[84rem] px-4 pt-6 pb-16 md:px-8 md:pt-9">{children}</main>
      </div>
    </div>
  );
}
