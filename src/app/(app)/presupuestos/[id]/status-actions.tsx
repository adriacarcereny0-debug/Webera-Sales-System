"use client";
import { useActionState } from "react";
import { setQuoteStatus } from "../actions";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { QUOTE_TRANSITIONS, type QuoteStatus } from "@/lib/stages";
import type { ButtonVariant } from "@/components/ui/button";

const LABELS: Partial<Record<QuoteStatus, { label: string; variant: ButtonVariant; hint?: string }>> = {
  revisado: { label: "Dar por revisado", variant: "primary", hint: "Confirma que conceptos, cantidades, precios e IVA son correctos." },
  enviado: { label: "Marcar como enviado", variant: "primary", hint: "Úsalo cuando se lo hayas enviado al cliente (PDF por email, WhatsApp o en mano)." },
  aceptado: { label: "Aceptado por el cliente", variant: "primary" },
  rechazado: { label: "Rechazado", variant: "secondary" },
  caducado: { label: "Caducado sin respuesta", variant: "ghost" },
  borrador: { label: "Volver a borrador para modificar", variant: "ghost" },
};

export function StatusActions({ id, status, canReview }: { id: string; status: QuoteStatus; canReview: boolean }) {
  const [state, action] = useActionState(setQuoteStatus, {});
  const next = QUOTE_TRANSITIONS[status];
  if (!next.length) return <p className="text-sm text-muted">Estado final. Para cambiar algo, duplica el presupuesto.</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {next.map((to) => {
        const m = LABELS[to]!;
        const blocked = to === "revisado" && !canReview;
        return (
          <div key={to}>
            <SubmitButton name="to" value={to} variant={m.variant} className="w-full" disabled={blocked} pendingLabel="Guardando…">{m.label}</SubmitButton>
            {blocked ? <p className="mt-1 text-[0.78rem] text-muted">La revisión la hace un administrador o el propietario.</p> :
              m.hint ? <p className="mt-1 text-[0.78rem] text-muted">{m.hint}</p> : null}
          </div>
        );
      })}
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
    </form>
  );
}
