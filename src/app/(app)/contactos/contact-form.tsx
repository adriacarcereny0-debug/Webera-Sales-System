"use client";
import { useActionState } from "react";
import Link from "next/link";
import { saveContact } from "./actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { SOURCES, STAGE_META, STAGES, TIMEFRAMES } from "@/lib/stages";
import type { CustomField } from "@/lib/custom-fields";

export interface ContactFormDefaults {
  id?: string;
  name?: string; company_name?: string; phone?: string; email?: string; address?: string; city?: string; postal_code?: string;
  service_id?: string; source?: string; owner_id?: string; estimated_amount?: string; stage?: string; next_action?: string;
  next_action_at?: string; timeframe?: string; description?: string; custom?: Record<string, unknown>;
}

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid-cols-1 grid gap-x-8 gap-y-4 border-b border-rule px-4 py-6 last:border-0 md:grid-cols-[14rem_minmax(0,1fr)] md:px-6">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-[0.82rem] text-muted">{description}</p>}
      </div>
      <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ContactForm({
  defaults, users, services, customFields, cancelHref,
}: {
  defaults: ContactFormDefaults; users: { id: string; name: string }[]; services: { id: string; name: string }[];
  customFields: CustomField[]; cancelHref: string;
}) {
  const [state, action] = useActionState(saveContact, {});
  const v = { ...defaults, ...(state.values ?? {}) } as Record<string, string | undefined>;
  const e = state.fieldErrors ?? {};
  const err = (k: string) => e[k];
  const isNew = !defaults.id;

  return (
    <form action={action} noValidate>
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {state.values?.confirm_duplicate && <input type="hidden" name="confirm_duplicate" value="1" />}
      {state.error && <div className="px-4 pt-5 md:px-6"><Notice kind={state.values?.confirm_duplicate ? "warn" : "error"}>{state.error}</Notice></div>}

      <Section title="Contacto" description="Persona o empresa que solicita la instalación.">
        <Field label="Nombre y apellidos" htmlFor="name" error={err("name")} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={v.name} required autoComplete="off" invalid={!!err("name")} aria-describedby={err("name") ? "name-error" : undefined} />
        </Field>
        <Field label="Empresa" htmlFor="company_name" optional error={err("company_name")}>
          <Input id="company_name" name="company_name" defaultValue={v.company_name} />
        </Field>
        <div className="hidden sm:block" />
        <Field label="Teléfono" htmlFor="phone" error={err("phone")} hint="Teléfono o email: al menos uno.">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={v.phone} invalid={!!err("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={v.email} invalid={!!err("email")} />
        </Field>
        <Field label="Dirección" htmlFor="address" optional className="sm:col-span-2">
          <Input id="address" name="address" defaultValue={v.address} autoComplete="street-address" />
        </Field>
        <Field label="Localidad" htmlFor="city" optional>
          <Input id="city" name="city" defaultValue={v.city} />
        </Field>
        <Field label="Código postal" htmlFor="postal_code" optional error={err("postal_code")}>
          <Input id="postal_code" name="postal_code" inputMode="numeric" maxLength={5} defaultValue={v.postal_code} invalid={!!err("postal_code")} />
        </Field>
      </Section>

      <Section title="Oportunidad" description="Qué necesita, de dónde viene y quién lo lleva.">
        <Field label="Tipo de instalación" htmlFor="service_id" optional>
          <Select id="service_id" name="service_id" defaultValue={v.service_id ?? ""}>
            <option value="">Sin especificar</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Origen" htmlFor="source" error={err("source")}>
          <Select id="source" name="source" defaultValue={v.source ?? "telefono"}>
            {Object.entries(SOURCES).filter(([k]) => k !== "importacion" || v.source === "importacion").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Responsable" htmlFor="owner_id" optional>
          <Select id="owner_id" name="owner_id" defaultValue={v.owner_id ?? ""}>
            <option value="">Sin asignar</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
        <Field label="Importe estimado (sin IVA)" htmlFor="estimated_amount" optional error={err("estimated_amount")} hint="Orientativo, para el pipeline. Ej.: 4.500">
          <Input id="estimated_amount" name="estimated_amount" inputMode="decimal" defaultValue={v.estimated_amount} invalid={!!err("estimated_amount")} />
        </Field>
        {isNew && (
          <Field label="Fase inicial" htmlFor="stage">
            <Select id="stage" name="stage" defaultValue={v.stage ?? "nuevo"}>
              {STAGES.filter((s) => s !== "perdido").map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Plazo del cliente" htmlFor="timeframe" optional>
          <Select id="timeframe" name="timeframe" defaultValue={v.timeframe ?? ""}>
            <option value="">Sin indicar</option>
            {Object.entries(TIMEFRAMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Descripción del proyecto" htmlFor="description" optional className="sm:col-span-2">
          <Textarea id="description" name="description" rows={4} defaultValue={v.description} />
        </Field>
      </Section>

      <Section title="Próxima acción" description="Lo siguiente que hay que hacer. Aparece en el panel y en el pipeline.">
        <Field label="Qué hay que hacer" htmlFor="next_action" optional>
          <Input id="next_action" name="next_action" defaultValue={v.next_action} placeholder="Ej.: Llamar para concretar visita" />
        </Field>
        <Field label="Cuándo" htmlFor="next_action_at" optional error={err("next_action_at")}>
          <Input id="next_action_at" name="next_action_at" type="datetime-local" defaultValue={v.next_action_at} />
        </Field>
      </Section>

      {customFields.length > 0 && (
        <Section title="Datos adicionales" description="Campos configurados por tu empresa.">
          {customFields.map((f) => {
            const name = `cf_${f.key}`;
            const dv = (state.values?.[name] ?? defaults.custom?.[f.key]) as string | number | boolean | undefined;
            if (f.type === "si_no") {
              return <Checkbox key={f.key} name={name} label={f.label} defaultChecked={dv === true || dv === "on"} className="sm:col-span-2" />;
            }
            return (
              <Field key={f.key} label={f.label} htmlFor={name} optional error={err(name)}>
                {f.type === "opcion" ? (
                  <Select id={name} name={name} defaultValue={dv === undefined ? "" : String(dv)}>
                    <option value="">Sin indicar</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : (
                  <Input id={name} name={name} inputMode={f.type === "numero" ? "decimal" : undefined} defaultValue={dv === undefined ? "" : String(dv)} />
                )}
              </Field>
            );
          })}
        </Section>
      )}

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-rule bg-sheet/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancelar</Link>
        <SubmitButton pendingLabel="Guardando…">{state.values?.confirm_duplicate ? "Guardar de todos modos" : isNew ? "Crear contacto" : "Guardar cambios"}</SubmitButton>
      </div>
    </form>
  );
}
