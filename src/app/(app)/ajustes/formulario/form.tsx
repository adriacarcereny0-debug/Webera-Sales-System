"use client";
import { useActionState } from "react";
import { saveFormSettings } from "../actions";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { CompanySettings } from "@/server/company";

export function FormSettings({ c }: { c: CompanySettings }) {
  const [state, action] = useActionState(saveFormSettings, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 p-4 md:p-5" noValidate>
      <Checkbox name="form_enabled" defaultChecked={c.form_enabled} label="Formulario activo" hint="Si lo desactivas, el formulario muestra tu teléfono en lugar de los campos." />
      <Checkbox name="form_photos_enabled" defaultChecked={c.form_photos_enabled} label="Permitir adjuntar fotos"
        hint="Hasta 3 imágenes de 5 MB. Se comprueba que sean imágenes reales y se guardan en la base de datos, visibles solo para usuarios de tu empresa." />
      <Field label="Texto de introducción" htmlFor="form_intro" optional><Textarea id="form_intro" name="form_intro" rows={2} defaultValue={c.form_intro ?? ""} placeholder="Cuéntanos qué necesitas y te contactamos para valorar la instalación." /></Field>
      <Field label="Mensaje de confirmación" htmlFor="form_thanks" optional><Textarea id="form_thanks" name="form_thanks" rows={2} defaultValue={c.form_thanks ?? ""} placeholder="Gracias. Te llamaremos en menos de 24 horas laborables." /></Field>
      <div className="grid-cols-1 grid gap-4 sm:grid-cols-2">
        <Field label="Responsable del tratamiento" htmlFor="privacy_controller" optional hint="Por defecto, la razón social."><Input id="privacy_controller" name="privacy_controller" defaultValue={c.privacy_controller ?? ""} /></Field>
        <Field label="Enlace a tu política de privacidad" htmlFor="privacy_url" optional error={e.privacy_url}><Input id="privacy_url" name="privacy_url" type="url" defaultValue={c.privacy_url ?? ""} placeholder="https://tuweb.es/privacidad" /></Field>
      </div>
      <Notice kind="info">El texto de protección de datos del formulario es una base informativa. Revísalo con tu asesoría o delegado de protección de datos y enlaza tu política de privacidad completa.</Notice>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
        {state.ok && <p role="status" className="text-[0.85rem] text-ok">{state.message}</p>}
        {state.error && <p role="alert" className="text-[0.85rem] text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
