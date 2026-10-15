"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { createCompany, createCompanyUser, setUserPassword, updateCompany, updateCompanyUser, type CredentialState } from "../../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { CredentialsCard } from "@/components/admin/credentials";
import { PasswordFields } from "@/components/admin/password-fields";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { slugify } from "@/lib/validation";

function ColorInput({ name, defaultValue, error }: { name: string; defaultValue: string; error?: string }) {
  const [c, setC] = useState(defaultValue);
  return (
    <Field label="Color de marca" htmlFor={`${name}-text`} error={error}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label="Selector de color" value={c} onChange={(e) => setC(e.target.value)} className="h-11 w-14 cursor-pointer rounded-md border-0 bg-transparent p-0 md:h-9" />
        <Input id={`${name}-text`} name={name} value={c} onChange={(e) => setC(e.target.value)} className="w-32 font-mono" maxLength={7} />
      </div>
    </Field>
  );
}

export function NewCompanyForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState<CredentialState, FormData>(createCompany, {});
  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const e = state.fieldErrors ?? {};
  if (state.ok && state.credentials) {
    return (
      <div className="space-y-5">
        <Notice kind="ok" title={state.message}>Ya puede entrar. Su formulario web está en <span className="font-mono">{appUrl}/f/{slug || slugify(name)}</span>.</Notice>
        <CredentialsCard {...state.credentials} appUrl={appUrl} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/empresas/${state.values?.id}`} className={buttonClass("primary")}>Ver la empresa</Link>
          <button type="button" onClick={() => window.location.assign("/admin/empresas/nueva")} className={buttonClass("secondary")}>Dar de alta otra</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-0" noValidate>
      {state.error && <Notice kind="error" className="mb-5">{state.error}</Notice>}
      <fieldset className="grid grid-cols-1 gap-x-8 gap-y-4 border-b border-rule pb-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <legend className="sr-only">Empresa</legend>
        <div aria-hidden><p className="font-semibold">Empresa</p><p className="mt-1 text-[0.8rem] text-muted">El instalador que contrata el servicio.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial" htmlFor="name" error={e.name}>
            <Input id="name" name="name" required value={name} onChange={(ev) => { setName(ev.target.value); if (!slugTouched) setSlug(slugify(ev.target.value)); }} />
          </Field>
          <Field label="Identificador" htmlFor="slug" error={e.slug} hint="Para su formulario: /f/identificador">
            <Input id="slug" name="slug" value={slug} onChange={(ev) => { setSlugTouched(true); setSlug(ev.target.value); }} className="font-mono" />
          </Field>
          <ColorInput name="brand_color" defaultValue="#23408e" error={e.brand_color} />
          <Field label="Nota interna" htmlFor="plan_note" optional hint="Plan contratado, fecha de renovación… Solo la ve Webera.">
            <Textarea id="plan_note" name="plan_note" rows={2} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-x-8 gap-y-4 py-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <legend className="sr-only">Propietario</legend>
        <div aria-hidden><p className="font-semibold">Acceso del propietario</p><p className="mt-1 text-[0.8rem] text-muted">La persona que administrará la cuenta. Podrá invitar a su equipo.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="owner_name" error={e.owner_name}><Input id="owner_name" name="owner_name" required /></Field>
          <Field label="Email (será su usuario)" htmlFor="owner_email" error={e.owner_email}><Input id="owner_email" name="owner_email" type="email" required /></Field>
          <div className="sm:col-span-2"><PasswordFields idPrefix="owner" error={e.password} /></div>
          <Checkbox name="sample_data" className="sm:col-span-2" label="Cargar datos de ejemplo" hint="Contactos y presupuestos ficticios marcados como «Demo», que el cliente puede borrar con un clic." />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-rule pt-4">
        <Link href="/admin/empresas" className={buttonClass("ghost")}>Cancelar</Link>
        <SubmitButton pendingLabel="Creando…">Crear empresa y acceso</SubmitButton>
      </div>
    </form>
  );
}

export function EditCompanyForm({ c }: { c: { id: string; name: string; slug: string; brand_color: string; plan_note: string | null; active: boolean } }) {
  const [state, action] = useActionState(updateCompany, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:p-5" noValidate>
      <input type="hidden" name="id" value={c.id} />
      <Field label="Nombre comercial" htmlFor="c-name" error={e.name}><Input id="c-name" name="name" defaultValue={c.name} /></Field>
      <Field label="Identificador" htmlFor="c-slug" error={e.slug} hint="Cambiarlo cambia la URL de su formulario web."><Input id="c-slug" name="slug" defaultValue={c.slug} className="font-mono" /></Field>
      <ColorInput name="brand_color" defaultValue={c.brand_color} error={e.brand_color} />
      <Field label="Nota interna" htmlFor="c-note" optional><Textarea id="c-note" name="plan_note" rows={2} defaultValue={c.plan_note ?? ""} /></Field>
      <Checkbox name="active" defaultChecked={c.active} className="sm:col-span-2" label="Cuenta activa"
        hint="Si la desactivas, nadie de la empresa podrá entrar y su formulario web dejará de aceptar solicitudes. Los datos se conservan." />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton variant="secondary" pendingLabel="Guardando…">Guardar empresa</SubmitButton>
        {(state.ok || state.error) && <p role="status" className={`text-[0.84rem] ${state.error ? "text-danger" : "text-ok"}`}>{state.error ?? state.message}</p>}
      </div>
    </form>
  );
}

export function CompanyUserRow({ u, appUrl }: { u: { id: string; name: string; email: string; role: Role; active: boolean; must_change_password: boolean; last_login_at: string | null; lastLoginLabel?: string }; appUrl: string }) {
  const [state, action] = useActionState(updateCompanyUser, {});
  const [pw, pwAction] = useActionState<CredentialState, FormData>(setUserPassword, {});
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 py-4 md:px-5">
      <form action={action} className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_auto_auto]">
        <input type="hidden" name="user_id" value={u.id} />
        <Field label="Nombre" htmlFor={`n-${u.id}`}><Input id={`n-${u.id}`} name="name" defaultValue={u.name} /></Field>
        <div className="min-w-0 pb-2 md:pb-2.5">
          <p className="truncate font-mono text-[0.86rem]">{u.email}</p>
          <p className="text-[0.76rem] text-muted">{u.lastLoginLabel ?? "Nunca ha entrado"}{u.must_change_password ? " · contraseña temporal" : ""}</p>
        </div>
        <Field label="Rol" htmlFor={`r-${u.id}`}>
          <Select id={`r-${u.id}`} name="role" defaultValue={u.role}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </Field>
        <Checkbox name="active" defaultChecked={u.active} label="Activo" className="h-11 items-center md:h-9" />
        <SubmitButton variant="secondary" pendingLabel="…">Guardar</SubmitButton>
      </form>
      {(state.ok || state.error) && <p role="status" className={`mt-2 text-[0.8rem] ${state.error ? "text-danger" : "text-ok"}`}>{state.error ?? state.message}</p>}
      <div className="mt-3">
        {!open && !pw.ok && <button type="button" onClick={() => setOpen(true)} className="text-[0.84rem] font-medium text-brand hover:underline">Cambiar contraseña…</button>}
        {open && !pw.ok && (
          <form action={pwAction} className="mt-2 max-w-md space-y-3 rounded-md bg-paper p-3 ring-1 ring-inset ring-rule">
            <input type="hidden" name="user_id" value={u.id} />
            <PasswordFields idPrefix={u.id} error={pw.fieldErrors?.password} />
            {pw.error && !pw.fieldErrors?.password && <Notice kind="error">{pw.error}</Notice>}
            <div className="flex gap-2">
              <SubmitButton pendingLabel="Guardando…">Establecer contraseña</SubmitButton>
              <button type="button" className={buttonClass("ghost")} onClick={() => setOpen(false)}>Cancelar</button>
            </div>
          </form>
        )}
        {pw.ok && pw.credentials && <div className="mt-2 max-w-xl"><CredentialsCard {...pw.credentials} appUrl={appUrl} /></div>}
      </div>
    </div>
  );
}

export function NewCompanyUserForm({ companyId, appUrl }: { companyId: string; appUrl: string }) {
  const [state, action] = useActionState<CredentialState, FormData>(createCompanyUser, {});
  const e = state.fieldErrors ?? {};
  if (state.ok && state.credentials) {
    return (
      <div className="space-y-3 p-4 md:p-5">
        <CredentialsCard {...state.credentials} appUrl={appUrl} />
        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => window.location.reload()}>Añadir otro usuario</button>
      </div>
    );
  }
  return (
    <form action={action} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:p-5" noValidate>
      <input type="hidden" name="company_id" value={companyId} />
      <Field label="Nombre" htmlFor="nu-name" error={e.name}><Input id="nu-name" name="name" required /></Field>
      <Field label="Email (usuario)" htmlFor="nu-email" error={e.email}><Input id="nu-email" name="email" type="email" required /></Field>
      <Field label="Rol" htmlFor="nu-role">
        <Select id="nu-role" name="role" defaultValue="comercial">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2"><PasswordFields idPrefix="nu" error={e.password} /></div>
      {state.error && !Object.keys(e).length && <Notice kind="error" className="sm:col-span-2">{state.error}</Notice>}
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Creando…">Crear usuario</SubmitButton></div>
    </form>
  );
}
