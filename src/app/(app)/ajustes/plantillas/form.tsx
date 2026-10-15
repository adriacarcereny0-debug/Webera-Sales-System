"use client";
import { useActionState, useMemo, useState } from "react";
import { saveTemplate } from "../actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { renderTemplate } from "@/lib/company-defaults";

const SAMPLE: Record<string, string> = {
  empresa: "Tu empresa", folio: "000042", nombre: "Nombre del cliente", telefono: "600 000 000", email: "cliente@ejemplo.es",
  localidad: "46701 Gandia", servicio: "Aerotermia", plazo: "En el próximo mes", descripcion: "Descripción enviada por el cliente.",
  enlace: "https://…/contactos/…", codigo: "P-2026-0012", cliente: "Nombre del cliente", total: "4.235,00 €", dias: "4",
  enviado: "10/10/2026", responsable: "Nombre del comercial", titulo: "Visita técnica", fecha: "16/10/2026", hora: "10:30",
  lugar: "Dirección de la visita", horas: "4",
};

export function TemplateForm({ k, subject, body, vars }: { k: string; subject: string; body: string; vars: string[] }) {
  const [state, action] = useActionState(saveTemplate, {});
  const [subj, setSubj] = useState(subject);
  const [text, setText] = useState(body);
  const preview = useMemo(() => ({ s: renderTemplate(subj, SAMPLE), b: renderTemplate(text, SAMPLE) }), [subj, text]);
  return (
    <form action={action} className="grid-cols-1 grid gap-5 p-4 md:p-5 xl:grid-cols-2">
      <input type="hidden" name="key" value={k} />
      <div className="space-y-3">
        <Field label="Asunto" htmlFor={`s-${k}`}><Input id={`s-${k}`} name="subject" value={subj} onChange={(e) => setSubj(e.target.value)} /></Field>
        <Field label="Texto" htmlFor={`b-${k}`}><Textarea id={`b-${k}`} name="body" rows={9} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[0.84rem]" /></Field>
        <p className="text-[0.78rem] text-muted">Variables: {vars.map((v) => <code key={v} className="mr-1 inline-block rounded bg-paper px-1 py-0.5 text-[0.75rem] ring-1 ring-inset ring-rule">{`{{${v}}}`}</code>)}</p>
        <div className="flex items-center gap-3">
          <SubmitButton variant="secondary" pendingLabel="Guardando…">Guardar plantilla</SubmitButton>
          {(state.ok || state.error) && <p role="status" className={`text-[0.82rem] ${state.error ? "text-danger" : "text-ok"}`}>{state.error ?? state.message}</p>}
        </div>
      </div>
      <div className="rounded-md bg-paper p-4 ring-1 ring-inset ring-rule" aria-label="Vista previa con datos de ejemplo">
        <p className="text-[0.72rem] font-medium tracking-[0.08em] text-muted uppercase">Vista previa</p>
        <p className="mt-2 font-semibold">{preview.s}</p>
        <p className="mt-2 text-[0.85rem] whitespace-pre-line text-ink-2">{preview.b}</p>
      </div>
    </form>
  );
}
