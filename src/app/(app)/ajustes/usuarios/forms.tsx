"use client";
import { useActionState } from "react";
import { createUser, resetUserPassword, updateUser } from "../actions";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export function NewUserForm({ allowOwner }: { allowOwner: boolean }) {
  const [state, action] = useActionState(createUser, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 p-4 md:p-5" noValidate>
      <div className="grid-cols-1 grid gap-4 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end">
        <Field label="Nombre" htmlFor="u-name" error={e.name}><Input id="u-name" name="name" required /></Field>
        <Field label="Email" htmlFor="u-email" error={e.email}><Input id="u-email" name="email" type="email" required /></Field>
        <Field label="Rol" htmlFor="u-role">
          <Select id="u-role" name="role" defaultValue="comercial">
            {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => allowOwner || r !== "propietario").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </Field>
        <SubmitButton pendingLabel="Creando…">Crear usuario</SubmitButton>
      </div>
      {state.error && !Object.keys(e).length && <Notice kind="error">{state.error}</Notice>}
      {state.ok && (
        <Notice kind="ok" title="Usuario creado">
          Comunica estos datos a la persona por un canal seguro. Deberá cambiar la contraseña al entrar.
          <span className="mt-2 block font-mono text-[0.9rem]">{state.values?.email} · {state.values?.password}</span>
        </Notice>
      )}
    </form>
  );
}

export function UserRow({ u, isSelf, canManage, allowOwner }: { u: { id: string; name: string; email: string; role: Role; active: boolean }; isSelf: boolean; canManage: boolean; allowOwner: boolean }) {
  const [state, action] = useActionState(updateUser, {});
  const [pwState, pwAction] = useActionState(resetUserPassword, {});
  return (
    <div className="px-4 py-3.5 md:px-5">
      <form action={action} className="grid-cols-1 grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_12rem_7.5rem_auto]">
        <input type="hidden" name="id" value={u.id} />
        <div className="min-w-0">
          <p className="truncate font-medium">{u.name}{isSelf && <span className="ml-2 text-[0.78rem] font-normal text-muted">(tú)</span>}</p>
          <p className="truncate text-[0.82rem] text-muted">{u.email}</p>
        </div>
        <label className="sr-only" htmlFor={`r-${u.id}`}>Rol de {u.name}</label>
        <Select id={`r-${u.id}`} name="role" defaultValue={u.role} disabled={!canManage || isSelf || (u.role === "propietario" && !allowOwner)}>
          {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => allowOwner || r !== "propietario" || u.role === "propietario").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Checkbox name="active" defaultChecked={u.active} label="Activo" disabled={!canManage || isSelf} />
        {canManage && !isSelf && <SubmitButton variant="secondary" size="sm" pendingLabel="…">Guardar</SubmitButton>}
      </form>
      {canManage && !isSelf && (
        <form action={pwAction} className="mt-2">
          <input type="hidden" name="id" value={u.id} />
          <button type="submit" className="text-[0.8rem] text-brand hover:underline">Generar contraseña temporal</button>
        </form>
      )}
      {(state.error || state.ok) && <p role="status" className={`mt-1 text-[0.8rem] ${state.error ? "text-danger" : "text-ok"}`}>{state.error ?? state.message}</p>}
      {pwState.error && <p role="alert" className="mt-1 text-[0.8rem] text-danger">{pwState.error}</p>}
      {pwState.ok && <Notice kind="ok" className="mt-2"><span className="font-mono">{pwState.message}</span></Notice>}
    </div>
  );
}
