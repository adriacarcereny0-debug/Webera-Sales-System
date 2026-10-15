"use client";
import { useActionState } from "react";
import { adminLogin } from "../actions";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLogin, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.values?.email} autoFocus /></Field>
      <Field label="Contraseña" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <SubmitButton className="w-full" pendingLabel="Comprobando…">Entrar en la consola</SubmitButton>
    </form>
  );
}
