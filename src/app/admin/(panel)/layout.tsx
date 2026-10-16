import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { WeberaWordmark } from "@/components/brand/webera-mark";
import { adminLogout } from "../actions";
import { AdminNav } from "./admin-nav";

export const metadata = { title: { default: "Consola", template: "%s · Consola Webera" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  const newLeads = await withSystem(async (tx) => (await tx.one<{ n: number }>(`select count(*)::int as n from platform_leads where status = 'nueva'`))?.n ?? 0);
  return (
    <div className="min-h-dvh">
      <header className="bg-[#0c1229] text-white">
        <div className="mx-auto flex max-w-[84rem] items-center justify-between gap-4 px-4 pt-4 md:px-8">
          <WeberaWordmark tone="light" sub="Consola de plataforma" />
          <div className="flex items-center gap-1">
            <span className="hidden text-right text-[0.8rem] leading-tight sm:block">
              <span className="block text-white/85">{s.admin.name}</span>
              <span className="block text-white/45">{s.admin.email}</span>
            </span>
            <form action={adminLogout}>
              <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="ml-2 inline-flex size-10 items-center justify-center rounded-md text-white/60 hover:bg-white/8 hover:text-white">
                <LogOut className="size-[18px]" strokeWidth={1.6} />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-[84rem] px-4 md:px-8"><AdminNav newLeads={newLeads} /></div>
      </header>
      <main id="contenido" className="mx-auto max-w-[84rem] px-4 pt-7 pb-16 md:px-8 md:pt-9">{children}</main>
    </div>
  );
}
