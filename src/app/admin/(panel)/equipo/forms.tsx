"use client";
import { useActionState } from "react";
import { changeAdminPassword, createPlatformAdmin, type CredentialState } from "../../actions";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { CredentialsCard } from "@/components/admin/credentials";

export function NewAdminForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState<CredentialState, FormData>(createPlatformAdmin, {});
  if (state.ok && state.credentials) return <div className="p-4 md:p-5"><CredentialsCard {...state.credentials} appUrl={`${appUrl}/admin`} company="Consola de plataforma" /></div>;
  return (
    <form action={action} className="grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] md:p-5">
      <Field label="Nombre" htmlFor="a-name"><Input id="a-name" name="name" required /></Field>
      <Field label="Email" htmlFor="a-email"><Input id="a-email" name="email" type="email" required /></Field>
      <SubmitButton pendingLabel="Creando…">Añadir</SubmitButton>
      {state.error && <Notice kind="error" className="sm:col-span-3">{state.error}</Notice>}
    </form>
  );
}

export function OwnPasswordForm() {
  const [state, action] = useActionState(changeAdminPassword, {});
  return (
    <form action={action} className="space-y-3 p-4 md:p-5">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <Notice kind="ok">{state.message}</Notice>}
      <Field label="Contraseña actual" htmlFor="cur"><Input id="cur" name="current" type="password" autoComplete="current-password" /></Field>
      <Field label="Nueva contraseña" htmlFor="nxt" hint="Mínimo 12 caracteres, con letras y números."><Input id="nxt" name="next" type="password" autoComplete="new-password" /></Field>
      <Field label="Repite la nueva" htmlFor="rep"><Input id="rep" name="repeat" type="password" autoComplete="new-password" /></Field>
      <SubmitButton pendingLabel="Guardando…">Cambiar mi contraseña</SubmitButton>
    </form>
  );
}
