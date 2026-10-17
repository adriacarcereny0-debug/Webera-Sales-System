import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { relative } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader } from "@/components/ui/misc";
import { Chip } from "@/components/ui/chip";
import { toggleAdmin } from "../../actions";
import { NewAdminForm, OwnPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Equipo Webora Studio" };

export default async function TeamPage() {
  const s = await requireAdmin();
  const admins = await withSystem((tx) => tx.query<{ id: string; name: string; email: string; active: boolean; last_login_at: string | null }>(
    `select id, name, email, active, last_login_at from platform_admins order by active desc, name`));
  return (
    <>
      <PageHeader title="Equipo Webora Studio" description="Personas con acceso a esta consola. Tienen control total sobre todas las empresas: dalo solo a quien lo necesite." />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Sheet>
            <SheetHeader title="Administradores" />
            <ul className="divide-y divide-rule">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">{a.name}{a.id === s.admin.id && <span className="text-[0.78rem] font-normal text-muted">(tú)</span>}{!a.active && <Chip tint="tint-gris">Desactivado</Chip>}</p>
                    <p className="truncate font-mono text-[0.82rem] text-muted">{a.email} · {a.last_login_at ? `entró ${relative(a.last_login_at)}` : "nunca ha entrado"}</p>
                  </div>
                  {a.id !== s.admin.id && (
                    <form action={toggleAdmin}><input type="hidden" name="id" value={a.id} />
                      <button className="text-[0.84rem] font-medium text-brand hover:underline">{a.active ? "Desactivar" : "Reactivar"}</button></form>
                  )}
                </li>
              ))}
            </ul>
          </Sheet>
          <Sheet>
            <SheetHeader title="Añadir administrador" description="Se genera una contraseña segura de 20 caracteres que se muestra una sola vez." />
            <NewAdminForm appUrl={env.appUrl} />
          </Sheet>
        </div>
        <Sheet><SheetHeader title="Mi contraseña" /><OwnPasswordForm /></Sheet>
      </div>
    </>
  );
}
