"use client";
import { startTransition, useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CompanyEmailProvider, CompanyEmailStatus } from "@/lib/email/company-config";

const OPTIONS: { id: CompanyEmailProvider; title: string; text: string; badge?: string }[] = [
  { id: "gmail", title: "Gmail", text: "Tu cuenta de Gmail o Google Workspace. Unos 500 correos al día.", badge: "Más fácil" },
  { id: "smtp", title: "Correo de tu dominio", text: "El correo que te da tu hosting (IONOS, Hostinger, Arsys…): info@tuempresa.es." },
  { id: "resend", title: "Resend", text: "Servicio de envío: 3.000 correos al mes gratis. Necesita tu dominio." },
];

const ext = "text-brand underline underline-offset-2";

type EmailAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Lo usan tanto cada empresa (Ajustes › Correo) como Webora Studio (/admin/correo): cambia solo la acción de guardar. */
export function EmailConnectForm({ own, save }: { own: CompanyEmailStatus["own"]; save: EmailAction }) {
  const [provider, setProvider] = useState<CompanyEmailProvider>(own?.provider ?? "gmail");
  const [state, action, pending] = useActionState(save, {});
  const e = state.fieldErrors ?? {};
  const sameAsSaved = own?.provider === provider;
  const savedHint = sameAsSaved && own?.secretHint ? `Guardada (termina en ····${own.secretHint}). Déjala vacía para mantenerla.` : undefined;

  return (
    // Envío manual (sin `action`) para que, si la prueba falla, los datos escritos no se borren del formulario.
    <form className="space-y-5 p-4 md:p-5" noValidate
      onSubmit={(ev) => { ev.preventDefault(); const fd = new FormData(ev.currentTarget); startTransition(() => action(fd)); }}>
      <fieldset>
        <legend className="mb-2 text-[0.82rem] font-medium text-ink-2">¿Desde qué correo quieres enviar?</legend>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {OPTIONS.map((o) => (
            <label key={o.id} className={cn("relative flex cursor-pointer flex-col gap-1 rounded-lg p-3.5 ring-1 transition-shadow",
              provider === o.id ? "bg-brand-soft ring-2 ring-brand" : "bg-sheet ring-rule-strong hover:ring-[color-mix(in_oklab,var(--rule-strong)_60%,var(--ink))]")}>
              <input type="radio" name="provider" value={o.id} checked={provider === o.id} onChange={() => setProvider(o.id)} className="sr-only" />
              <span className="flex items-center justify-between gap-2">
                <span className="text-[0.92rem] font-semibold text-ink">{o.title}</span>
                {o.badge && <span className="tint-verde tint-chip rounded-[4px] px-1.5 py-0.5 text-[0.7rem] font-semibold">{o.badge}</span>}
              </span>
              <span className="text-[0.8rem] leading-snug text-muted">{o.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {provider === "gmail" && (
        <>
          <Notice kind="info" title="Cómo conseguir la contraseña de aplicación (1 minuto)">
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Activa la <a className={ext} href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">verificación en 2 pasos</a> de tu cuenta de Google, si no la tienes.</li>
              <li>Abre <a className={ext} href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Contraseñas de aplicaciones</a>, escribe «Webora Studio» y pulsa Crear.</li>
              <li>Copia las 16 letras que aparecen y pégalas aquí abajo.</li>
            </ol>
            <p className="mt-2">No es la contraseña de tu Gmail: es una clave aparte que puedes anular cuando quieras.</p>
          </Notice>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tu dirección de Gmail" htmlFor="from_email" error={e.from_email}>
              <Input id="from_email" name="from_email" type="email" autoComplete="email" defaultValue={own?.provider === "gmail" ? own.fromEmail : ""} placeholder="tuempresa@gmail.com" invalid={!!e.from_email} />
            </Field>
            <Field label="Contraseña de aplicación" htmlFor="secret" error={e.secret} hint={savedHint ?? "16 letras, con o sin espacios."}>
              <Input id="secret" name="secret" type="password" autoComplete="new-password" placeholder="abcd efgh ijkl mnop" invalid={!!e.secret} />
            </Field>
          </div>
        </>
      )}

      {provider === "smtp" && (
        <>
          <Notice kind="info" title="Dónde encontrar estos datos">
            En el panel de tu hosting, en la sección de correo, suele haber un apartado «Configurar en Outlook / cliente de correo».
            Ahí verás el <strong>servidor de salida (SMTP)</strong> y el <strong>puerto</strong>. El usuario suele ser la propia dirección y la contraseña, la de ese buzón.
          </Notice>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dirección de envío" htmlFor="from_email" error={e.from_email}>
              <Input id="from_email" name="from_email" type="email" defaultValue={own?.provider === "smtp" ? own.fromEmail : ""} placeholder="info@tuempresa.es" invalid={!!e.from_email} />
            </Field>
            <Field label="Servidor de salida (SMTP)" htmlFor="smtp_host" error={e.smtp_host}>
              <Input id="smtp_host" name="smtp_host" defaultValue={own?.smtpHost ?? ""} placeholder="smtp.tuempresa.es" autoCapitalize="none" invalid={!!e.smtp_host} />
            </Field>
            <Field label="Puerto" htmlFor="smtp_port" hint="465 (SSL) o 587 (STARTTLS).">
              <Select id="smtp_port" name="smtp_port" defaultValue={String(own?.smtpPort ?? 465)}>
                <option value="465">465 · SSL</option>
                <option value="587">587 · STARTTLS</option>
              </Select>
            </Field>
            <Field label="Usuario" htmlFor="smtp_user" optional hint="Si lo dejas vacío, se usa la dirección de envío.">
              <Input id="smtp_user" name="smtp_user" defaultValue={own?.provider === "smtp" ? own.smtpUser ?? "" : ""} autoCapitalize="none" />
            </Field>
            <Field label="Contraseña del buzón" htmlFor="secret" error={e.secret} hint={savedHint} className="sm:col-span-2">
              <Input id="secret" name="secret" type="password" autoComplete="new-password" invalid={!!e.secret} />
            </Field>
          </div>
        </>
      )}

      {provider === "resend" && (
        <>
          <Notice kind="info" title="Cómo conectarlo">
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Crea una cuenta gratis en <a className={ext} href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a> (3.000 correos al mes, 100 al día).</li>
              <li>En <strong>Domains</strong>, añade tu dominio y copia los registros DNS en tu proveedor de dominio. Sin este paso solo podrás enviarte correos a ti.</li>
              <li>En <strong>API Keys</strong>, crea una clave y pégala aquí.</li>
            </ol>
          </Notice>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dirección de envío" htmlFor="from_email" error={e.from_email} hint="Debe ser de tu dominio verificado.">
              <Input id="from_email" name="from_email" type="email" defaultValue={own?.provider === "resend" ? own.fromEmail : ""} placeholder="avisos@tuempresa.es" invalid={!!e.from_email} />
            </Field>
            <Field label="API key de Resend" htmlFor="secret" error={e.secret} hint={savedHint ?? "Empieza por re_"}>
              <Input id="secret" name="secret" type="password" autoComplete="new-password" placeholder="re_…" invalid={!!e.secret} />
            </Field>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />}
          {pending ? "Conectando y enviando prueba…" : "Guardar y enviar correo de prueba"}
        </Button>
        {state.ok && <p role="status" className="text-[0.85rem] text-ok">{state.message}</p>}
        {state.error && <p role="alert" className="max-w-xl text-[0.85rem] text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

export function TestEmailButton({ test }: { test: () => Promise<ActionState> }) {
  const [state, action] = useActionState(test, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton variant="secondary" pendingLabel="Enviando…">Enviar otra prueba</SubmitButton>
      {state.ok && <p role="status" className="text-[0.85rem] text-ok">{state.message}</p>}
      {state.error && <p role="alert" className="max-w-xl text-[0.85rem] text-danger">{state.error}</p>}
    </form>
  );
}
