import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getCompany } from "@/server/company";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { removeLogo } from "../actions";
import { CompanyForm, LogoForm } from "./forms";

export const metadata: Metadata = { title: "Empresa y marca" };

export default async function CompanyPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const c = await tenant(s, getCompany);
  return (
    <div className="space-y-5">
      <Sheet>
        <SheetHeader title="Logotipo" description="Aparece en la barra lateral, el formulario web y los presupuestos."
          actions={c.has_logo ? <form action={removeLogo}><button className="text-[0.82rem] text-muted hover:text-danger hover:underline">Quitar</button></form> : undefined} />
        <div className="p-4 md:p-5"><LogoForm slug={c.slug} hasLogo={c.has_logo} /></div>
      </Sheet>
      <Sheet><CompanyForm c={c} /></Sheet>
    </div>
  );
}
