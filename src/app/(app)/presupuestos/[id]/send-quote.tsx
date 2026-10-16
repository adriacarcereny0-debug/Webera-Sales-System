"use client";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendQuoteEmail } from "../actions";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function SendQuoteForm({ id, email, again }: { id: string; email: string | null; again: boolean }) {
  const [state, action] = useActionState(sendQuoteEmail, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Email del cliente" htmlFor="send-to">
        <Input id="send-to" name="to" type="email" defaultValue={email ?? ""} placeholder="cliente@email.com" />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Enviando…"><Send className="size-4" strokeWidth={1.75} aria-hidden />{again ? "Reenviar por email" : "Enviar por email"}</SubmitButton>
      <p className="text-[0.78rem] text-muted">Le llega un correo con un enlace para ver el presupuesto, descargar el PDF y aceptarlo con un clic.</p>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
    </form>
  );
}
