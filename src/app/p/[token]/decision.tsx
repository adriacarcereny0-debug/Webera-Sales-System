"use client";
import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { decideQuote } from "./actions";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";

export function QuoteDecision({ token, total }: { token: string; total: string }) {
  const [state, action] = useActionState(decideQuote.bind(null, token), {});
  const [mode, setMode] = useState<"none" | "rechazar">("none");
  if (state.ok) {
    return state.message === "aceptado"
      ? <Notice kind="ok" title="¡Presupuesto aceptado!">Gracias. Hemos avisado a la empresa y se pondrá en contacto contigo para planificar la instalación.</Notice>
      : <Notice kind="info" title="Respuesta enviada">Gracias por avisarnos. Hemos trasladado tu respuesta a la empresa.</Notice>;
  }
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="decision" value="aceptado" />
        <SubmitButton className="h-12 w-full text-[1rem]" pendingLabel="Enviando…"><Check className="size-5" strokeWidth={2} aria-hidden />Aceptar presupuesto · {total}</SubmitButton>
        <p className="text-[0.78rem] text-muted">Al aceptar, la empresa recibe tu conformidad y te contactará para fijar la fecha.</p>
      </form>
      {mode === "none" ? (
        <button type="button" onClick={() => setMode("rechazar")} className={buttonClass("ghost", "md", "w-full")}>No me interesa</button>
      ) : (
        <form action={action} className="space-y-3 rounded-md bg-paper p-3 ring-1 ring-inset ring-rule">
          <input type="hidden" name="decision" value="rechazado" />
          <Field label="¿Nos cuentas el motivo?" htmlFor="note" optional hint="Nos ayuda a mejorar. Por ejemplo: precio, plazos, lo dejo para más adelante…">
            <Textarea id="note" name="note" rows={3} maxLength={1000} />
          </Field>
          <SubmitButton variant="secondary" className="w-full" pendingLabel="Enviando…"><X className="size-4" strokeWidth={1.75} aria-hidden />Rechazar presupuesto</SubmitButton>
        </form>
      )}
      {state.error && <Notice kind="error">{state.error}</Notice>}
    </div>
  );
}
