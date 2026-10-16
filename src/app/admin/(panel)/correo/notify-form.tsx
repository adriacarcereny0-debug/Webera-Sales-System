"use client";
import { useActionState } from "react";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { savePlatformNotify } from "../../platform-actions";

export function NotifyForm({ notifyEmails, leadAutoReply }: { notifyEmails: string[]; leadAutoReply: boolean }) {
  const [state, action] = useActionState(savePlatformNotify, {});
  return (
    <form action={action} className="space-y-4 p-4 md:p-5">
      <Field label="Avisar a" htmlFor="notify_emails" error={state.fieldErrors?.notify_emails}
        hint="Un email por línea. Si lo dejas vacío, se avisa a todos los administradores de Webera.">
        <Textarea id="notify_emails" name="notify_emails" rows={3} defaultValue={notifyEmails.join("\n")} placeholder="ventas@webera.es" />
      </Field>
      <Checkbox name="lead_auto_reply" defaultChecked={leadAutoReply} label="Contestar automáticamente al interesado"
        hint="Recibe al momento un correo de «Hemos recibido tu solicitud, te llamamos muy pronto»." />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Guardando…">Guardar</SubmitButton>
        {state.ok && <p role="status" className="text-[0.85rem] text-ok">{state.message}</p>}
        {state.error && <p role="alert" className="text-[0.85rem] text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
