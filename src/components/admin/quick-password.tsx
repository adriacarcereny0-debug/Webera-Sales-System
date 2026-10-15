"use client";
import { useActionState, useState } from "react";
import { setUserPassword, type CredentialState } from "@/app/admin/actions";
import { PasswordFields } from "./password-fields";
import { CredentialsCard } from "./credentials";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";

export function QuickPassword({ userId, appUrl, label = "Cambiar contraseña" }: { userId: string; appUrl: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<CredentialState, FormData>(setUserPassword, {});
  if (state.ok && state.credentials) return <div className="mt-2 max-w-xl"><CredentialsCard {...state.credentials} appUrl={appUrl} /></div>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-[0.84rem] font-medium text-brand hover:underline">{label}</button>;
  return (
    <form action={action} className="mt-2 max-w-md space-y-3 rounded-md bg-paper p-3 ring-1 ring-inset ring-rule">
      <input type="hidden" name="user_id" value={userId} />
      <PasswordFields idPrefix={`q-${userId}`} error={state.fieldErrors?.password} />
      {state.error && !state.fieldErrors?.password && <Notice kind="error">{state.error}</Notice>}
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Guardando…">Establecer</SubmitButton>
        <button type="button" className={buttonClass("ghost")} onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
