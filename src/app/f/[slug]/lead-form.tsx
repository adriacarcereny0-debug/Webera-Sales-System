"use client";
import { useActionState, useEffect } from "react";
import { submitLead, type LeadState } from "./actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { TIMEFRAMES } from "@/lib/stages";

export function LeadForm({
  slug, token, services, photosEnabled, thanks, privacy,
}: {
  slug: string; token: string; services: { id: string; name: string }[]; photosEnabled: boolean; thanks: string | null;
  privacy: { controller: string; email: string | null; url: string | null };
}) {
  const [state, action] = useActionState<LeadState, FormData>(submitLead.bind(null, slug), {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  // Comunica la altura a la página que incrusta el formulario (iframe autoajustable).
  useEffect(() => {
    const send = () => window.parent?.postMessage({ type: "webera-form-height", slug, height: document.documentElement.scrollHeight }, "*");
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [slug, state]);

  if (state.ok) {
    return (
      <div role="status" className="overflow-hidden rounded-lg bg-sheet shadow-sheet ring-1 ring-rule">
        <div className="tint-verde border-b border-[var(--t-line)] bg-[var(--t-bg)] px-6 py-5 text-[var(--t-fg)]">
          <p className="text-[0.75rem] font-medium tracking-[0.1em] uppercase opacity-80">Solicitud recibida</p>
          <p className="folio mt-1 text-[2rem] leading-none">Nº {state.folio}</p>
        </div>
        <div className="space-y-2 px-6 py-5 text-[0.95rem] text-ink-2">
          <p>{thanks || "Gracias. Hemos recibido tu solicitud y te contactaremos lo antes posible."}</p>
          <p className="text-[0.85rem] text-muted">Si nos llamas, indica tu número de solicitud para localizarla más rápido.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="t" value={token} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">No rellenar este campo</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error && <Notice kind="error">{state.error}</Notice>}

      <Field label="Nombre" htmlFor="name" error={e.name}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={v.name} invalid={!!e.name} />
      </Field>
      <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono" htmlFor="phone" error={e.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} invalid={!!e.phone} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email} hint="Teléfono o email: con uno basta.">
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} invalid={!!e.email} />
        </Field>
      </div>
      <Field label="Código postal o localidad" htmlFor="location" error={e.location}>
        <Input id="location" name="location" autoComplete="postal-code" required defaultValue={v.location} invalid={!!e.location} />
      </Field>
      <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de instalación" htmlFor="service_id" optional>
          <Select id="service_id" name="service_id" defaultValue={v.service_id ?? ""}>
            <option value="">No lo sé / otra</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="¿Para cuándo?" htmlFor="timeframe" optional>
          <Select id="timeframe" name="timeframe" defaultValue={v.timeframe ?? ""}>
            <option value="">Sin decidir</option>
            {Object.entries(TIMEFRAMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Cuéntanos tu proyecto" htmlFor="description" optional error={e.description}>
        <Textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={v.description}
          placeholder="Tipo de vivienda o local, metros aproximados, qué instalación tienes ahora…" />
      </Field>
      {photosEnabled && (
        <Field label="Fotos" htmlFor="photos" optional hint={state.error ? "Si habías adjuntado fotos, vuelve a seleccionarlas." : "Hasta 3 fotos JPG, PNG o WEBP de 5 MB como máximo (por ejemplo, de la fachada o del cuadro eléctrico)."}>
          <input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"
            className="block w-full cursor-pointer rounded-md text-sm text-muted ring-1 ring-inset ring-rule-strong file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:bg-paper file:px-3 file:text-ink" />
        </Field>
      )}

      <div className="rounded-md bg-paper px-3.5 py-3 text-[0.78rem] leading-relaxed text-muted ring-1 ring-inset ring-rule">
        <p><strong className="font-semibold text-ink-2">Protección de datos.</strong> Responsable: {privacy.controller}. Finalidad: atender tu solicitud y preparar tu presupuesto. Legitimación: tu consentimiento. No se ceden datos a terceros salvo obligación legal o a proveedores que nos prestan servicios tecnológicos. Puedes ejercer tus derechos de acceso, rectificación, supresión y demás{privacy.email ? <> escribiendo a <a className="underline" href={`mailto:${privacy.email}`}>{privacy.email}</a></> : null}.
          {privacy.url && <> Más información en la <a className="underline" href={privacy.url} target="_blank" rel="noopener">política de privacidad</a>.</>}</p>
      </div>
      <Checkbox name="consent" required label="He leído la información sobre protección de datos y acepto que me contactéis para atender mi solicitud." />
      {e.consent && <p className="-mt-2 text-[0.8rem] text-danger">{e.consent}</p>}

      <SubmitButton className="w-full" pendingLabel="Enviando…">Enviar solicitud</SubmitButton>
    </form>
  );
}
