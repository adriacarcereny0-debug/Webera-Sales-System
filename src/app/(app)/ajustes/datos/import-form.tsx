"use client";
import { useActionState } from "react";
import Link from "next/link";
import { commitImport, previewImport, type ImportState } from "./actions";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCents } from "@/lib/money";

const LABELS: Record<string, string> = {
  name: "Nombre", company_name: "Empresa", phone: "Teléfono", email: "Email", address: "Dirección", city: "Localidad", postal_code: "CP",
  service: "Instalación", estimated_amount: "Importe", description: "Notas", created_at: "Fecha de entrada",
};

export function ImportForm() {
  const [pv, preview] = useActionState<ImportState, FormData>(previewImport, {});
  const [done, commit] = useActionState<ImportState, FormData>(commitImport, {});
  const p = pv.preview;
  if (done.ok) return <div className="p-4 md:p-5"><Notice kind="ok" title="Importación completada">{done.message} <Link href="/contactos" className="font-medium underline">Ver contactos</Link></Notice></div>;
  return (
    <div className="space-y-4 p-4 md:p-5">
      <form action={preview} className="space-y-3">
        <label htmlFor="csv" className="block text-[0.82rem] font-medium text-ink-2">Archivo CSV (Excel: «Guardar como › CSV»), máx. 2.000 filas</label>
        <input id="csv" name="file" type="file" accept=".csv,text/csv" required
          className="block w-full cursor-pointer rounded-md text-sm text-muted ring-1 ring-inset ring-rule-strong file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:bg-paper file:px-3 file:text-ink" />
        <p className="text-[0.8rem] text-muted">Columnas reconocidas: Nombre (obligatoria), Teléfono, Email, Empresa, Dirección, Localidad, CP, Instalación, Importe, Notas, Fecha. Cada fila necesita teléfono o email.</p>
        <SubmitButton variant="secondary" pendingLabel="Comprobando…">Comprobar archivo</SubmitButton>
      </form>
      {pv.error && <Notice kind="error">{pv.error}</Notice>}
      {done.error && <Notice kind="error">{done.error}</Notice>}
      {p && (
        <div className="space-y-4 border-t border-rule pt-4">
          <p className="text-sm">
            <strong>{p.total}</strong> filas: <span className="text-ok">{p.valid.length} listas para importar</span>
            {p.duplicates.length > 0 && <>, <span className="text-warn">{p.duplicates.length} duplicadas (se omiten)</span></>}
            {p.invalid.length > 0 && <>, <span className="text-danger">{p.invalid.length} con errores (se omiten)</span></>}.
          </p>
          <p className="text-[0.8rem] text-muted">Columnas usadas: {p.mapped.map((m) => LABELS[m] ?? m).join(", ")}.{p.unmapped.length > 0 && ` Ignoradas: ${p.unmapped.join(", ")}.`}</p>
          {[...p.invalid, ...p.duplicates].length > 0 && (
            <details className="rounded-md bg-paper p-3 text-[0.82rem] ring-1 ring-inset ring-rule">
              <summary className="cursor-pointer font-medium">Ver filas omitidas</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {[...p.invalid, ...p.duplicates].sort((a, b) => a.line - b.line).map((x) => <li key={x.line}><span className="num text-muted">Fila {x.line}:</span> {x.reason}</li>)}
              </ul>
            </details>
          )}
          {p.valid.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-md ring-1 ring-rule">
                <table className="w-full min-w-[40rem] text-[0.82rem]">
                  <thead><tr className="bg-paper text-left text-muted"><th className="px-3 py-2 font-medium">Fila</th><th className="px-3 py-2 font-medium">Nombre</th><th className="px-3 py-2 font-medium">Teléfono</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Localidad</th><th className="px-3 py-2 text-right font-medium">Importe</th></tr></thead>
                  <tbody>
                    {p.valid.slice(0, 8).map((r) => (
                      <tr key={r.line} className="border-t border-rule"><td className="num px-3 py-2 text-muted">{r.line}</td><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2">{r.phone}</td><td className="px-3 py-2">{r.email}</td><td className="px-3 py-2">{[r.postal_code, r.city].filter(Boolean).join(" ")}</td><td className="num px-3 py-2 text-right">{r.estimated_amount !== null ? formatCents(r.estimated_amount) : ""}</td></tr>
                    ))}
                  </tbody>
                </table>
                {p.valid.length > 8 && <p className="border-t border-rule px-3 py-2 text-[0.78rem] text-muted">…y {p.valid.length - 8} más.</p>}
              </div>
              <form action={commit}>
                <input type="hidden" name="rows" value={JSON.stringify(p.valid)} />
                <SubmitButton pendingLabel="Importando…">Importar {p.valid.length} contacto{p.valid.length === 1 ? "" : "s"}</SubmitButton>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
