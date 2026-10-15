"use client";
import { useActionState, useState } from "react";
import { createTask } from "./actions";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

export function TaskForm({
  contactId, contacts, users, defaultAssignee, defaultDue, compact,
}: {
  contactId?: string; contacts?: { id: string; label: string }[]; users: { id: string; name: string }[];
  defaultAssignee: string; defaultDue: string; compact?: boolean;
}) {
  const [state, action] = useActionState(createTask, {});
  const [kind, setKind] = useState<"tarea" | "visita">((state.values?.kind as "tarea" | "visita") ?? "tarea");
  const [key, setKey] = useState(0);
  const e = state.fieldErrors ?? {};
  return (
    <form key={key} action={async (fd) => { await action(fd); }} className="space-y-3">
      {contactId && <input type="hidden" name="contact_id" value={contactId} />}
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-md bg-paper p-1 ring-1 ring-inset ring-rule">
        {(["tarea", "visita"] as const).map((k) => (
          <label key={k} className={cn("flex h-9 cursor-pointer items-center justify-center rounded text-[0.86rem] md:h-8", kind === k ? "bg-sheet font-semibold text-ink shadow-sheet" : "text-muted hover:text-ink")}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === "tarea" ? "Tarea" : "Visita técnica"}
          </label>
        ))}
      </div>
      <Field label={kind === "visita" ? "Motivo de la visita" : "Tarea"} htmlFor={`t-title-${contactId ?? "g"}`} error={e.title}>
        <Input id={`t-title-${contactId ?? "g"}`} name="title" required defaultValue={state.values?.title}
          placeholder={kind === "visita" ? "Ej.: Medición de estancias" : "Ej.: Llamar para confirmar presupuesto"} />
      </Field>
      <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
        <Field label="Fecha y hora" htmlFor={`t-due-${contactId ?? "g"}`} error={e.due_at}>
          <Input id={`t-due-${contactId ?? "g"}`} name="due_at" type="datetime-local" required defaultValue={state.values?.due_at ?? defaultDue} />
        </Field>
        {kind === "visita" && (
          <Field label="Duración" htmlFor={`t-dur-${contactId ?? "g"}`}>
            <Select id={`t-dur-${contactId ?? "g"}`} name="duration_min" defaultValue="60">
              <option value="30">30 min</option><option value="60">1 hora</option><option value="90">1 h 30 min</option><option value="120">2 horas</option><option value="240">Media jornada</option>
            </Select>
          </Field>
        )}
      </div>
      {kind === "visita" && (
        <Field label="Lugar" htmlFor={`t-loc-${contactId ?? "g"}`} optional>
          <Input id={`t-loc-${contactId ?? "g"}`} name="location" defaultValue={state.values?.location} placeholder="Dirección de la visita" />
        </Field>
      )}
      {!contactId && contacts && (
        <Field label="Contacto" htmlFor="t-contact" optional>
          <Select id="t-contact" name="contact_id" defaultValue={state.values?.contact_id ?? ""}>
            <option value="">Sin contacto</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Asignada a" htmlFor={`t-user-${contactId ?? "g"}`}>
        <Select id={`t-user-${contactId ?? "g"}`} name="assigned_to" defaultValue={state.values?.assigned_to ?? defaultAssignee}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && (
        <div className="flex items-center justify-between gap-2">
          <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>
          <button type="button" className="text-[0.82rem] text-brand underline" onClick={() => setKey((k) => k + 1)}>Crear otra</button>
        </div>
      )}
      <SubmitButton className="w-full" pendingLabel="Guardando…">{kind === "visita" ? "Programar visita" : "Crear tarea"}</SubmitButton>
    </form>
  );
}
