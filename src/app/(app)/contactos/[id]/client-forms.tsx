"use client";
import { useActionState, useState } from "react";
import { addNote, moveStage, setNextAction } from "../actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { STAGE_META, STAGES, type Stage } from "@/lib/stages";
import { cn } from "@/lib/cn";

export function StageControl({ id, current }: { id: string; current: Stage }) {
  const [state, action] = useActionState(moveStage, {});
  const [target, setTarget] = useState<Stage>(current);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend className="mb-2 text-[0.82rem] font-medium text-ink-2">Mover a la fase</legend>
        <div className="grid grid-cols-1 gap-1">
          {STAGES.map((st) => (
            <label key={st} className={cn(
              STAGE_META[st].tint, "flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[0.86rem] md:h-8",
              target === st ? "tint-chip font-semibold" : "text-ink-2 hover:bg-paper",
            )}>
              <input type="radio" name="stage" value={st} checked={target === st} onChange={() => setTarget(st)} className="size-4 accent-[var(--brand)]" />
              {STAGE_META[st].label}
              {st === current && <span className="ml-auto text-[0.72rem] font-normal opacity-70">actual</span>}
            </label>
          ))}
        </div>
      </fieldset>
      {target !== current && (
        <div className="space-y-3">
          {target === "perdido" && (
            <Field label="Motivo" htmlFor="lost_reason">
              <Input id="lost_reason" name="lost_reason" required placeholder="Ej.: eligió otra oferta" />
            </Field>
          )}
          <Field label="Nota del cambio" htmlFor="stage-note" optional>
            <Input id="stage-note" name="note" placeholder="Ej.: visita confirmada por teléfono" />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Guardando…">Mover a «{STAGE_META[target].short}»</SubmitButton>
        </div>
      )}
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && state.message && target === current && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
    </form>
  );
}

const NOTE_TYPES = [
  ["nota", "Nota"], ["llamada", "Llamada"], ["email", "Email"], ["whatsapp", "WhatsApp"], ["visita", "Visita"],
] as const;

export function NoteComposer({ contactId }: { contactId: string }) {
  const [state, action] = useActionState(addNote, {});
  const [key, setKey] = useState(0);
  return (
    <form action={async (fd) => { await action(fd); setKey((k) => k + 1); }} className="space-y-2.5">
      <input type="hidden" name="contact_id" value={contactId} />
      <label htmlFor="note-body" className="sr-only">Nueva anotación</label>
      <Textarea key={key} id="note-body" name="body" rows={3} required placeholder="Qué se ha hablado, qué ha pedido el cliente, qué queda pendiente…" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="note-type" className="text-[0.82rem] text-muted">Tipo</label>
          <Select id="note-type" name="type" defaultValue="nota" className="w-auto">
            {NOTE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
        <SubmitButton size="md" pendingLabel="Guardando…">Añadir al historial</SubmitButton>
      </div>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
    </form>
  );
}

export function NextActionForm({ id, action: current, at }: { id: string; action: string; at: string }) {
  const [state, action] = useActionState(setNextAction, {});
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="id" value={id} />
      <Field label="Qué hay que hacer" htmlFor="na">
        <Input id="na" name="next_action" defaultValue={current} placeholder="Ej.: Llamar para concretar visita" />
      </Field>
      <Field label="Cuándo" htmlFor="na-at">
        <Input id="na-at" name="next_action_at" type="datetime-local" defaultValue={at} />
      </Field>
      <SubmitButton variant="secondary" className="w-full" pendingLabel="Guardando…">Guardar próxima acción</SubmitButton>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
    </form>
  );
}
