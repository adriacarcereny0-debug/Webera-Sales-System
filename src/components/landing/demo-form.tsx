"use client";
import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { requestDemo } from "@/app/solicitud-actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function DemoForm({ token, source }: { token: string; source?: string }) {
  const [state, action] = useActionState(requestDemo, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  if (state.ok) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 py-6">
        <CircleCheck className="size-9 text-ok" strokeWidth={1.6} aria-hidden />
        <p className="text-[1.25rem] font-semibold text-ink">¡Recibido!</p>
        <p className="max-w-md text-[0.98rem] text-ink-2">Te escribiremos muy pronto para enseñarte Webora Studio con ejemplos de tu día a día. Si nos has dejado tu email, revisa también la carpeta de spam.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="source" value={source ?? ""} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">No rellenar este campo</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tu nombre" htmlFor="d-name" error={e.name}><Input id="d-name" name="name" autoComplete="name" defaultValue={v.name} invalid={!!e.name} /></Field>
        <Field label="Empresa" htmlFor="d-company" error={e.company}><Input id="d-company" name="company" autoComplete="organization" defaultValue={v.company} invalid={!!e.company} /></Field>
        <Field label="Email" htmlFor="d-email" error={e.email}><Input id="d-email" name="email" type="email" autoComplete="email" defaultValue={v.email} invalid={!!e.email} /></Field>
        <Field label="Teléfono" htmlFor="d-phone" optional error={e.phone}><Input id="d-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} invalid={!!e.phone} /></Field>
        <Field label="Localidad" htmlFor="d-city" optional><Input id="d-city" name="city" autoComplete="address-level2" defaultValue={v.city} /></Field>
        <Field label="¿Cuántos sois?" htmlFor="d-team" optional>
          <Select id="d-team" name="team_size" defaultValue={v.team_size ?? ""}>
            <option value="">Elige una opción</option>
            <option value="1">Solo yo</option>
            <option value="2-5">De 2 a 5 personas</option>
            <option value="6-15">De 6 a 15 personas</option>
            <option value="16+">Más de 15 personas</option>
          </Select>
        </Field>
      </div>
      <Field label="¿Qué te gustaría mejorar?" htmlFor="d-msg" optional hint="Por ejemplo: se me pierden solicitudes, tardo en hacer presupuestos, no sé qué está pendiente…">
        <Textarea id="d-msg" name="message" rows={3} maxLength={2000} defaultValue={v.message} />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 text-[0.85rem] text-ink-2">
        <input type="checkbox" name="consent" className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-[var(--brand)]" />
        <span>Acepto que Webora Studio use estos datos solo para contactarme sobre esta solicitud. No se ceden a terceros y puedo pedir que se borren respondiendo a cualquiera de sus correos.</span>
      </label>
      {e.consent && <p className="text-[0.8rem] text-danger">{e.consent}</p>}
      <SubmitButton className="h-12 w-full text-[1rem] sm:w-auto sm:px-6" pendingLabel="Enviando…">Pedir una demostración</SubmitButton>
      {state.error && <p role="alert" className="text-[0.88rem] text-danger">{state.error}</p>}
    </form>
  );
}
