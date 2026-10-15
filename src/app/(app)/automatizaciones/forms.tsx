"use client";
import { useActionState, useState } from "react";
import { Play } from "lucide-react";
import { runNow, saveAutomation } from "./actions";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AutomationConfig, AutomationKey } from "@/lib/company-defaults";
import { cn } from "@/lib/cn";

export function Toggle({ name, defaultChecked, label, onChange }: { name: string; defaultChecked: boolean; label: string; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" name={name} role="switch" checked={on} onChange={(e) => { setOn(e.target.checked); onChange?.(e.target.checked); }} className="peer sr-only" />
      <span aria-hidden className={cn("relative h-6 w-11 rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
        on ? "bg-ok" : "bg-rule-strong")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-out)]", on && "translate-x-5")} />
      </span>
      <span className={cn("text-[0.86rem] font-medium", on ? "text-ok" : "text-muted")}>{on ? "Activa" : "Desactivada"}</span>
      <span className="sr-only">{label}</span>
    </label>
  );
}

export function AutomationForm({ k, title, enabled, config, canManage }: { k: AutomationKey; title: string; enabled: boolean; config: AutomationConfig; canManage: boolean }) {
  const [state, action] = useActionState(saveAutomation, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="key" value={k} />
      <fieldset disabled={!canManage} className="space-y-4">
        <Toggle name="enabled" defaultChecked={enabled} label={`Activar «${title}»`} />
        <div className="grid-cols-1 grid gap-3 sm:grid-cols-2">
          {config.days !== undefined && (
            <Field label="Días sin seguimiento" htmlFor={`${k}-days`}><Input id={`${k}-days`} name="days" type="number" min={1} max={60} defaultValue={config.days} /></Field>
          )}
          {config.hours !== undefined && (
            <Field label="Horas en «Nuevo contacto»" htmlFor={`${k}-hours`}><Input id={`${k}-hours`} name="hours" type="number" min={1} max={240} defaultValue={config.hours} /></Field>
          )}
          {config.hoursBefore !== undefined && (
            <Field label="Horas de antelación" htmlFor={`${k}-hb`}><Input id={`${k}-hb`} name="hoursBefore" type="number" min={1} max={168} defaultValue={config.hoursBefore} /></Field>
          )}
          {config.recipients !== undefined && (
            <Field label="Destinatarios" htmlFor={`${k}-rcp`} className="sm:col-span-2" hint="Separados por comas. Si lo dejas vacío, se usan los emails de aviso de Ajustes › Empresa o, en su defecto, los administradores.">
              <Input id={`${k}-rcp`} name="recipients" defaultValue={(config.recipients ?? []).join(", ")} placeholder="oficina@tuempresa.es" />
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {config.createTask !== undefined && <Checkbox name="createTask" defaultChecked={config.createTask} label="Crear tarea" />}
          {config.sendEmail !== undefined && <Checkbox name="sendEmail" defaultChecked={config.sendEmail} label="Enviar email" />}
        </div>
      </fieldset>
      {canManage && <SubmitButton variant="secondary" pendingLabel="Guardando…">Guardar</SubmitButton>}
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
    </form>
  );
}

export function RunNowForm() {
  const [state, action] = useActionState(runNow, {});
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="primary" pendingLabel="Ejecutando…"><Play className="size-4" strokeWidth={2} aria-hidden />Ejecutar ahora</SubmitButton>
      {state.error && <Notice kind="warn">{state.error}</Notice>}
      {state.ok && <Notice kind="ok">{state.message}</Notice>}
    </form>
  );
}
