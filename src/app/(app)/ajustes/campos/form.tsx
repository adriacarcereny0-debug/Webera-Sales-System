"use client";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveCustomFields } from "../actions";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import type { CustomField } from "@/lib/custom-fields";

type Row = { key?: string; label: string; type: string; options: string; uid: number };

export function CustomFieldsForm({ fields }: { fields: CustomField[] }) {
  const [state, action] = useActionState(saveCustomFields, {});
  const [rows, setRows] = useState<Row[]>(fields.map((f, i) => ({ key: f.key, label: f.label, type: f.type, options: (f.options ?? []).join(", "), uid: i })));
  const [next, setNext] = useState(fields.length);
  const set = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <form action={action} className="p-4 md:p-5">
      <input type="hidden" name="fields" value={JSON.stringify(rows)} />
      {rows.length === 0 && <p className="mb-4 text-sm text-muted">No hay campos personalizados. Añade, por ejemplo, «Potencia contratada (kW)», «Tipo de cubierta» o «¿Tiene subvención?».</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.uid} className="grid-cols-1 grid gap-2 rounded-md bg-paper p-2 ring-1 ring-inset ring-rule md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto]">
            <Input aria-label={`Nombre del campo ${i + 1}`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Nombre del campo" maxLength={60} />
            <Select aria-label={`Tipo del campo ${i + 1}`} value={r.type} onChange={(e) => set(i, { type: e.target.value })}>
              <option value="texto">Texto</option><option value="numero">Número</option><option value="opcion">Lista</option><option value="si_no">Sí / No</option>
            </Select>
            <Input aria-label={`Opciones del campo ${i + 1}`} value={r.options} onChange={(e) => set(i, { options: e.target.value })} disabled={r.type !== "opcion"}
              placeholder={r.type === "opcion" ? "Opciones separadas por comas" : "—"} />
            <button type="button" aria-label={`Quitar campo ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
              className="flex size-11 items-center justify-center rounded-md text-faint hover:bg-sheet hover:text-danger md:size-9"><Trash2 className="size-4" strokeWidth={1.6} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={rows.length >= 12} className={buttonClass("secondary")} onClick={() => { setRows((x) => [...x, { label: "", type: "texto", options: "", uid: next }]); setNext((n) => n + 1); }}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />Añadir campo
        </button>
        <SubmitButton pendingLabel="Guardando…">Guardar campos</SubmitButton>
        {(state.ok || state.error) && <p role="status" className={`text-[0.82rem] ${state.error ? "text-danger" : "text-ok"}`}>{state.error ?? state.message}</p>}
      </div>
    </form>
  );
}
