import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listServices } from "@/server/contacts";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { ConfirmAction } from "@/components/ui/confirm";
import { deleteService } from "../actions";
import { ServiceRow } from "./forms";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const services = await tenant(s, async (tx) => {
    const list = await listServices(tx, false);
    const used = await tx.query<{ service_id: string; n: number }>(`select service_id, count(*)::int as n from contacts where service_id is not null group by service_id`);
    const by = Object.fromEntries(used.map((u) => [u.service_id, u.n]));
    return list.map((x) => ({ ...x, used: by[x.id] ?? 0 }));
  });
  return (
    <div className="space-y-5">
      <Sheet>
        <SheetHeader title="Tipos de instalación y servicios" description="Aparecen en el formulario web, en los contactos y en las estadísticas. Los inactivos no se ofrecen en el formulario." />
        <p id="orden-ayuda" className="sr-only">Número de orden: los menores aparecen primero.</p>
        <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_5rem_auto_auto] gap-2 border-b border-rule px-5 py-2 text-[0.75rem] font-medium text-muted md:grid">
          <span>Nombre</span><span>Descripción</span><span>Orden</span><span /><span />
        </div>
        <ul className="divide-y divide-rule">
          {services.map((x) => (
            <li key={x.id} className="relative">
              <ServiceRow s={x} />
              <div className="flex items-center justify-between px-4 pb-3 text-[0.78rem] text-muted md:px-5">
                <span>{x.used ? `${x.used} contacto${x.used === 1 ? "" : "s"}` : "Sin contactos"}</span>
                <ConfirmAction label={x.used ? "Desactivar" : "Eliminar"} variant="ghost" size="sm" title={`¿${x.used ? "Desactivar" : "Eliminar"} «${x.name}»?`}
                  confirmLabel={x.used ? "Desactivar" : "Eliminar"} action={deleteService} fields={{ id: x.id }}>
                  {x.used ? "Tiene contactos asociados, así que se desactiva en lugar de borrarse." : "Se borrará definitivamente."}
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet>
        <SheetHeader title="Añadir servicio" />
        <ServiceRow />
      </Sheet>
    </div>
  );
}
