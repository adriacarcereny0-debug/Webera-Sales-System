import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getCompany } from "@/server/company";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { CustomFieldsForm } from "./form";

export const metadata: Metadata = { title: "Campos personalizados" };

export default async function FieldsPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const c = await tenant(s, getCompany);
  return (
    <Sheet>
      <SheetHeader title="Campos personalizados de contacto" description="Datos propios de tu negocio que se rellenan en la ficha del contacto. Máximo 12. Quitar un campo no borra los datos ya guardados, solo deja de mostrarlos." />
      <CustomFieldsForm fields={c.custom_fields} />
    </Sheet>
  );
}
