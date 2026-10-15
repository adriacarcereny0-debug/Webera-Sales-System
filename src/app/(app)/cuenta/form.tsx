"use client";
import { useActionState } from "react";
import Link from "next/link";
import { changeOwnPassword } from "../ajustes/actions";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function PasswordForm() {
  const [state, action] = useActionState(changeOwnPassword, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <Notice kind="ok">{state.message} <Link href="/panel" className="font-medium underline">Ir al panel</Link></Notice>}
      <Field label="Contraseña actual" htmlFor="current" error={e.current}><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nueva contraseña" htmlFor="next" error={e.next} hint="Al menos 10 caracteres, con letras y números."><Input id="next" name="next" type="password" autoComplete="new-password" required /></Field>
      <Field label="Repite la nueva contraseña" htmlFor="repeat" error={e.repeat}><Input id="repeat" name="repeat" type="password" autoComplete="new-password" required /></Field>
      <SubmitButton pendingLabel="Guardando…">Cambiar contraseña</SubmitButton>
    </form>
  );
}
