import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { PageHeader, Sheet, SheetHeader, Notice, Definition } from "@/components/ui/misc";
import { PasswordForm } from "./form";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ cambio?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession({ allowPasswordChange: true });
  return (
    <>
      <PageHeader title="Mi cuenta" />
      {(sp.cambio === "obligatorio" || s.user.mustChangePassword) && (
        <Notice kind="warn" className="mb-5" title="Cambia tu contraseña temporal">Por seguridad, antes de continuar debes elegir una contraseña propia.</Notice>
      )}
      <div className="grid-cols-1 grid items-start gap-5 lg:grid-cols-2">
        <Sheet>
          <SheetHeader title="Datos" />
          <dl className="divide-y divide-rule px-4 md:px-5">
            <Definition term="Nombre">{s.user.name}</Definition>
            <Definition term="Email">{s.user.email}</Definition>
            <Definition term="Empresa">{s.company.name}</Definition>
            <Definition term="Rol">{ROLE_LABELS[s.user.role]} — <span className="text-muted">{ROLE_DESCRIPTIONS[s.user.role]}</span></Definition>
          </dl>
        </Sheet>
        <Sheet>
          <SheetHeader title="Contraseña" />
          <div className="p-4 md:p-5"><PasswordForm /></div>
        </Sheet>
      </div>
    </>
  );
}
