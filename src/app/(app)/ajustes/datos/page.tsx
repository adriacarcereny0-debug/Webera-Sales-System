import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { Sheet, SheetHeader, Notice } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { Flash } from "@/components/ui/flash";
import { ImportForm } from "./import-form";
import { deleteSampleData, loadSampleData, restoreDemo } from "./actions";

export const metadata: Metadata = { title: "Importar, exportar y demo" };

export default async function DataPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const sample = await tenant(s, async (tx) => (await tx.one<{ n: number }>(`select count(*)::int as n from contacts where is_demo`))?.n ?? 0);
  const r = s.user.role;
  return (
    <div className="space-y-5">
      <Flash code={sp.aviso} />
      {can(r, "data.import") && (
        <Sheet>
          <div id="importar" className="scroll-mt-6" />
          <SheetHeader title="Importar contactos desde CSV" description="Primero se comprueba el archivo y ves qué se importará. Las filas duplicadas o con errores se omiten." />
          <ImportForm />
        </Sheet>
      )}
      {can(r, "data.export") && (
        <Sheet>
          <SheetHeader title="Exportar datos" description="Archivos CSV compatibles con Excel (separador punto y coma). Cada exportación queda registrada en el historial." />
          <div className="flex flex-wrap gap-2 p-4 md:p-5">
            <a href="/api/export/contactos.csv" className={buttonClass("secondary")}><Download className="size-4" strokeWidth={1.75} aria-hidden />Contactos (CSV)</a>
            <a href="/api/export/presupuestos.csv" className={buttonClass("secondary")}><Download className="size-4" strokeWidth={1.75} aria-hidden />Presupuestos (CSV)</a>
            {r === "propietario" && <a href="/api/export/completo.json" className={buttonClass("secondary")}><Download className="size-4" strokeWidth={1.75} aria-hidden />Copia completa (JSON)</a>}
          </div>
          <p className="px-4 pb-4 text-[0.8rem] text-muted md:px-5">La copia completa incluye todos los datos de tu empresa salvo contraseñas y el contenido de las fotos. No sustituye a las copias de seguridad de la base de datos, que dependen del proveedor (ver manual).</p>
        </Sheet>
      )}
      {can(r, "demo.manage") && (
        <Sheet>
          <div id="demo" className="scroll-mt-6" />
          <SheetHeader title={s.company.isDemo ? "Restaurar la demostración" : "Datos de ejemplo"} />
          <div className="space-y-3 p-4 md:p-5">
            {s.company.isDemo ? (
              <>
                <p className="text-sm text-ink-2">Esta es una empresa de demostración. Restaurar borra todos sus contactos, presupuestos, tareas y emails y vuelve a crear los datos ficticios de partida. Los usuarios y ajustes se mantienen. No afecta a ninguna otra empresa.</p>
                <ConfirmAction label="Restaurar la demo" variant="primary" title="¿Restaurar la demostración?" confirmLabel="Restaurar" action={restoreDemo}>
                  Se perderán los cambios hechos durante la demostración.
                </ConfirmAction>
              </>
            ) : sample > 0 ? (
              <>
                <Notice kind="warn">Hay {sample} contactos de ejemplo (marcados como «Demo») mezclados con tus datos.</Notice>
                <ConfirmAction label="Eliminar los datos de ejemplo" title="¿Eliminar los datos de ejemplo?" confirmLabel="Eliminar" action={deleteSampleData}>
                  Se borran solo los registros marcados como demo, con sus presupuestos, tareas y notas. Tus datos reales no se tocan.
                </ConfirmAction>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-2">Carga contactos, presupuestos y tareas ficticios para practicar. Quedan marcados como «Demo» y se eliminan con un clic.</p>
                <form action={loadSampleData}><button className={buttonClass("secondary")}>Cargar datos de ejemplo</button></form>
              </>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
