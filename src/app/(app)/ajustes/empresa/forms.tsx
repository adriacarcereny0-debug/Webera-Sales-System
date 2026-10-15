"use client";
/* eslint-disable @next/next/no-img-element */
import { useActionState, useState } from "react";
import { saveCompany, uploadLogo } from "../actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { contrastText } from "@/lib/brand";
import type { CompanySettings } from "@/server/company";

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid-cols-1 grid gap-x-8 gap-y-4 border-b border-rule px-4 py-6 last:border-0 md:grid-cols-[12rem_minmax(0,1fr)] md:px-6">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden><p className="font-semibold">{title}</p>{description && <p className="mt-1 text-[0.8rem] text-muted">{description}</p>}</div>
      <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function CompanyForm({ c }: { c: CompanySettings }) {
  const [state, action] = useActionState(saveCompany, {});
  const [color, setColor] = useState(c.brand_color);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {state.error && <div className="px-4 pt-5 md:px-6"><Notice kind="error">{state.error}</Notice></div>}
      <Group title="Identidad" description="Nombre comercial y datos fiscales.">
        <Field label="Nombre comercial" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={c.name} required /></Field>
        <Field label="Razón social" htmlFor="legal_name" optional><Input id="legal_name" name="legal_name" defaultValue={c.legal_name ?? ""} /></Field>
        <Field label="NIF / CIF" htmlFor="tax_id" optional error={e.tax_id}><Input id="tax_id" name="tax_id" defaultValue={c.tax_id ?? ""} /></Field>
        <Field label="Web" htmlFor="website" optional error={e.website}><Input id="website" name="website" type="url" defaultValue={c.website ?? ""} placeholder="https://" /></Field>
      </Group>
      <Group title="Contacto y horario">
        <Field label="Teléfono" htmlFor="phone" optional error={e.phone}><Input id="phone" name="phone" type="tel" defaultValue={c.phone ?? ""} /></Field>
        <Field label="Email" htmlFor="email" optional error={e.email}><Input id="email" name="email" type="email" defaultValue={c.email ?? ""} /></Field>
        <Field label="Dirección" htmlFor="address" optional className="sm:col-span-2"><Input id="address" name="address" defaultValue={c.address ?? ""} /></Field>
        <Field label="Localidad" htmlFor="city" optional><Input id="city" name="city" defaultValue={c.city ?? ""} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="C. P." htmlFor="postal_code" optional error={e.postal_code}><Input id="postal_code" name="postal_code" defaultValue={c.postal_code ?? ""} inputMode="numeric" maxLength={5} /></Field>
          <Field label="Provincia" htmlFor="province" optional><Input id="province" name="province" defaultValue={c.province ?? ""} /></Field>
        </div>
        <Field label="Horario de atención" htmlFor="schedule" optional className="sm:col-span-2"><Input id="schedule" name="schedule" defaultValue={c.schedule ?? ""} placeholder="Lunes a viernes, 8:00–14:00 y 16:00–19:00" /></Field>
        <Field label="Emails que reciben los avisos" htmlFor="notification_emails" optional error={e.notification_emails} className="sm:col-span-2" hint="Separados por comas. Para las nuevas solicitudes, si la automatización no tiene destinatarios propios.">
          <Input id="notification_emails" name="notification_emails" defaultValue={c.notification_emails.join(", ")} />
        </Field>
      </Group>
      <Group title="Color de marca" description="Barra lateral, botones y documentos. Se ajusta el texto para que siempre sea legible.">
        <div className="flex items-end gap-3 sm:col-span-2">
          <Field label="Color" htmlFor="brand_color" error={e.brand_color}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Selector de color" value={color} onChange={(ev) => setColor(ev.target.value)} className="h-11 w-14 cursor-pointer rounded-md border-0 bg-transparent p-0 md:h-9" />
              <Input id="brand_color" name="brand_color" value={color} onChange={(ev) => setColor(ev.target.value)} className="w-32 font-mono" maxLength={7} />
            </div>
          </Field>
          <div className="flex h-11 items-center rounded-md px-4 text-sm font-medium md:h-9" style={{ background: color, color: /^#[0-9a-f]{6}$/i.test(color) ? contrastText(color) : "#fff" }} aria-hidden>Vista previa del botón</div>
        </div>
      </Group>
      <Group title="Presupuestos" description="Numeración, validez, IVA y textos por defecto.">
        <Field label="Prefijo de numeración" htmlFor="quote_prefix" error={e.quote_prefix} hint="Ej.: P → P-2026-0001"><Input id="quote_prefix" name="quote_prefix" defaultValue={c.quote_prefix} maxLength={6} /></Field>
        <Field label="Validez (días)" htmlFor="quote_validity_days" error={e.quote_validity_days}><Input id="quote_validity_days" name="quote_validity_days" type="number" min={1} max={365} defaultValue={c.quote_validity_days} /></Field>
        <Field label="Tipos de IVA disponibles (%)" htmlFor="tax_rates" error={e.tax_rates} hint="Separados por comas. Ej.: 21, 10, 4, 0"><Input id="tax_rates" name="tax_rates" defaultValue={c.tax_rates.join(", ")} /></Field>
        <Field label="IVA por defecto (%)" htmlFor="default_tax_rate" error={e.default_tax_rate}><Input id="default_tax_rate" name="default_tax_rate" inputMode="decimal" defaultValue={Number(c.default_tax_rate)} /></Field>
        <Field label="Condiciones por defecto" htmlFor="quote_terms" optional className="sm:col-span-2"><Textarea id="quote_terms" name="quote_terms" rows={4} defaultValue={c.quote_terms ?? ""} placeholder="Forma de pago, garantía, plazo de ejecución…" /></Field>
        <Field label="Pie del documento" htmlFor="quote_footer" optional className="sm:col-span-2"><Input id="quote_footer" name="quote_footer" defaultValue={c.quote_footer ?? ""} placeholder="Inscrita en el Registro Mercantil de…" /></Field>
      </Group>
      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-rule bg-sheet/95 px-4 py-3 backdrop-blur-sm md:px-6">
        {state.ok && <p role="status" className="text-[0.85rem] text-ok">{state.message}</p>}
        <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
      </div>
    </form>
  );
}

export function LogoForm({ slug, hasLogo }: { slug: string; hasLogo: boolean }) {
  const [state, action] = useActionState(uploadLogo, {});
  return (
    <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-20 w-40 shrink-0 items-center justify-center rounded-md bg-paper p-2 ring-1 ring-inset ring-rule">
        {hasLogo ? <img src={`/api/public/logo/${slug}`} alt="Logotipo actual" className="max-h-full max-w-full object-contain" /> : <span className="text-[0.8rem] text-muted">Sin logotipo</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <label htmlFor="logo" className="block text-[0.82rem] font-medium text-ink-2">Subir logotipo (PNG o JPG, máx. 1 MB)</label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required
          className="block w-full cursor-pointer rounded-md text-sm text-muted ring-1 ring-inset ring-rule-strong file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:bg-paper file:px-3 file:text-ink" />
        <div className="flex items-center gap-3">
          <SubmitButton variant="secondary" pendingLabel="Subiendo…">Subir</SubmitButton>
          {state.ok && <p role="status" className="text-[0.82rem] text-ok">{state.message}</p>}
          {state.error && <p role="alert" className="text-[0.82rem] text-danger">{state.error}</p>}
        </div>
      </div>
    </form>
  );
}
