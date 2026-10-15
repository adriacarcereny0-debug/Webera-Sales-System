"use client";
import { useActionState } from "react";
import { saveService } from "../actions";
import { Checkbox, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ServiceRow({ s }: { s?: { id: string; name: string; description: string | null; active: boolean; sort: number } }) {
  const [state, action] = useActionState(saveService, {});
  const id = s?.id ?? "new";
  return (
    <form action={action} className="grid-cols-1 grid items-start gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_5rem_auto_auto] md:px-5">
      {s && <input type="hidden" name="id" value={s.id} />}
      <label className="sr-only" htmlFor={`sn-${id}`}>Nombre</label>
      <Input id={`sn-${id}`} name="name" defaultValue={s?.name} placeholder="Nombre del servicio" required />
      <label className="sr-only" htmlFor={`sd-${id}`}>Descripción</label>
      <Input id={`sd-${id}`} name="description" defaultValue={s?.description ?? ""} placeholder="Descripción breve (opcional)" />
      <label className="sr-only" htmlFor={`so-${id}`}>Orden</label>
      <Input id={`so-${id}`} name="sort" type="number" min={0} max={999} defaultValue={s?.sort ?? 0} aria-describedby="orden-ayuda" />
      {s ? <Checkbox name="active" defaultChecked={s.active} label="Activo" className="h-11 items-center md:h-9" /> : <span />}
      <div className="flex items-center gap-2">
        <SubmitButton variant={s ? "secondary" : "primary"} pendingLabel="…">{s ? "Guardar" : "Añadir"}</SubmitButton>
      </div>
      {(state.error || state.ok) && <p role="status" className={`md:col-span-5 text-[0.8rem] ${state.error ? "text-danger" : "text-ok"}`}>{state.error ?? state.message}</p>}
    </form>
  );
}
