import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/misc";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const r = s.user.role;
  const items = [
    { href: "/ajustes", label: "Resumen", show: true },
    { href: "/ajustes/empresa", label: "Empresa y marca", show: can(r, "settings.manage") },
    { href: "/ajustes/servicios", label: "Servicios", show: can(r, "settings.manage") },
    { href: "/ajustes/usuarios", label: "Usuarios y permisos", show: true },
    { href: "/ajustes/formulario", label: "Formulario web", show: can(r, "settings.manage") },
    { href: "/ajustes/correo", label: "Correo de envío", show: can(r, "settings.manage") },
    { href: "/ajustes/plantillas", label: "Plantillas de email", show: can(r, "settings.manage") },
    { href: "/ajustes/campos", label: "Campos personalizados", show: can(r, "settings.manage") },
    { href: "/ajustes/datos", label: "Importar, exportar y demo", show: can(r, "data.export") || can(r, "data.import") },
    { href: "/ajustes/actividad", label: "Historial de actividad", show: can(r, "audit.view") },
  ].filter((i) => i.show);
  return (
    <>
      <PageHeader title="Ajustes" description="Configura la empresa, el equipo y cómo trabaja el sistema." />
      <div className="grid-cols-1 grid items-start gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6"><SettingsNav items={items} /></div>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
