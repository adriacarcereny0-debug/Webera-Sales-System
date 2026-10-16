import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleCheck, CircleAlert, Mail } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getCompanyEmailStatus, EMAIL_PROVIDER_LABELS } from "@/lib/email/company-config";
import { fmtDateTime } from "@/lib/dates";
import { Sheet, SheetHeader, Notice } from "@/components/ui/misc";
import { ConfirmAction } from "@/components/ui/confirm";
import { disconnectEmail, saveEmailSettings, sendTestEmail } from "./actions";
import { EmailConnectForm, TestEmailButton } from "@/components/email/connect-form";

export const metadata: Metadata = { title: "Correo de envío" };

export default async function EmailSettingsPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const st = await getCompanyEmailStatus(s.company.id);
  const own = st.own;

  return (
    <div className="space-y-5">
      <Sheet>
        <SheetHeader title="Correo de envío"
          description="Los avisos automáticos (nuevas solicitudes, recordatorios de visitas, seguimiento de presupuestos) salen desde el correo que conectes aquí." />
        <div className="space-y-4 p-4 md:p-5">
          {own ? (
            <div className="flex items-start gap-3">
              {own.testOk === false
                ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.75} aria-hidden />
                : <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" strokeWidth={1.75} aria-hidden />}
              <div className="min-w-0 text-[0.9rem]">
                <p className="font-medium text-ink">
                  {own.testOk === false ? "Conectado, pero la última prueba falló" : "Conectado"}: <span className="break-all">{own.fromEmail}</span>
                </p>
                <p className="text-[0.82rem] text-muted">
                  {EMAIL_PROVIDER_LABELS[own.provider]}
                  {own.testedAt && <> · última prueba {fmtDateTime(own.testedAt)}{own.testOk ? " (correcta)" : ""}</>}
                  {" · "}{st.sentThisMonth} enviado{st.sentThisMonth === 1 ? "" : "s"} este mes
                </p>
                {own.testOk === false && own.testError && <p className="mt-1 text-[0.82rem] text-danger">{own.testError}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-5 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
              <div className="text-[0.9rem]">
                <p className="font-medium text-ink">Todavía no has conectado ningún correo</p>
                <p className="text-[0.82rem] text-muted">
                  {st.platformConfigured
                    ? "Mientras tanto, los avisos salen desde el correo general de Webera."
                    : "Mientras tanto, los avisos se quedan dentro de la aplicación (en Automatizaciones) y no llegan por email."}
                </p>
              </div>
            </div>
          )}
          {own && (
            <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
              <TestEmailButton test={sendTestEmail} />
              <ConfirmAction label="Desconectar" title="¿Desconectar este correo?" confirmLabel="Desconectar" action={disconnectEmail}>
                Se borrará la contraseña guardada. Los avisos dejarán de enviarse por email hasta que conectes otro correo.
              </ConfirmAction>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet>
        <SheetHeader title={own ? "Cambiar el correo conectado" : "Conectar tu correo"}
          description="Cada empresa usa su propio correo, así los avisos llevan tu dirección y tu límite de envío es solo tuyo." />
        <EmailConnectForm own={own} save={saveEmailSettings} />
      </Sheet>

      <Notice kind="info" title="Tu contraseña está protegida">
        Se guarda cifrada y nunca se vuelve a mostrar, ni a ti ni al equipo de Webera. Solo se usa para enviar los avisos de tu empresa.
      </Notice>
    </div>
  );
}
