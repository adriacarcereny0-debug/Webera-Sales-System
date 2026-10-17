import type { Metadata } from "next";
import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { getPlatformSettings } from "@/lib/email/platform-config";
import { EMAIL_PROVIDER_LABELS } from "@/lib/email/company-config";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader, Notice } from "@/components/ui/misc";
import { ConfirmAction } from "@/components/ui/confirm";
import { EmailConnectForm, TestEmailButton } from "@/components/email/connect-form";
import { disconnectPlatformEmail, savePlatformEmail, sendPlatformTestEmail } from "../../platform-actions";
import { NotifyForm } from "./notify-form";

export const metadata: Metadata = { title: "Correo de Webora Studio" };

export default async function PlatformEmailPage() {
  await requireAdmin();
  const st = await getPlatformSettings();
  const own = st.own;
  return (
    <>
      <PageHeader title="Correo de Webora Studio"
        description="Desde este correo te llegan las solicitudes de demostración, se contesta automáticamente a cada interesado y salen los avisos de las empresas que aún no han conectado el suyo." />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Sheet>
            <SheetHeader title="Estado" />
            <div className="space-y-4 p-4 md:p-5">
              {own ? (
                <div className="flex items-start gap-3">
                  {own.testOk === false
                    ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.75} aria-hidden />
                    : <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" strokeWidth={1.75} aria-hidden />}
                  <div className="min-w-0 text-[0.9rem]">
                    <p className="font-medium text-ink">{own.testOk === false ? "Conectado, pero la última prueba falló" : "Conectado"}: <span className="break-all">{own.fromEmail}</span></p>
                    <p className="text-[0.82rem] text-muted">{EMAIL_PROVIDER_LABELS[own.provider]}{own.testedAt && <> · última prueba {fmtDateTime(own.testedAt)}{own.testOk ? " (correcta)" : ""}</>}</p>
                    {own.testOk === false && own.testError && <p className="mt-1 text-[0.82rem] text-danger">{own.testError}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-5 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
                  <div className="text-[0.9rem]">
                    <p className="font-medium text-ink">Sin correo conectado</p>
                    <p className="text-[0.82rem] text-muted">{st.envConfigured
                      ? "Se usa el correo configurado en las variables del servidor."
                      : "Las solicitudes se guardan en «Solicitudes», pero no te llega ningún aviso por email ni se contesta al interesado."}</p>
                  </div>
                </div>
              )}
              {own && (
                <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
                  <TestEmailButton test={sendPlatformTestEmail} />
                  <ConfirmAction label="Desconectar" title="¿Desconectar el correo de Webora Studio?" confirmLabel="Desconectar" action={disconnectPlatformEmail}>
                    Se borrará la contraseña guardada. Dejarán de llegarte avisos de solicitudes por email.
                  </ConfirmAction>
                </div>
              )}
            </div>
          </Sheet>
          <Sheet>
            <SheetHeader title={own ? "Cambiar el correo conectado" : "Conectar el correo de Webora Studio"}
              description="Lo más rápido: una cuenta de Gmail con una contraseña de aplicación. Con tu dominio quedará más profesional." />
            <EmailConnectForm own={own} save={savePlatformEmail} />
          </Sheet>
        </div>
        <Sheet>
          <SheetHeader title="Solicitudes de demostración" description="Qué pasa cuando un instalador pide una demo en la página pública." />
          <NotifyForm notifyEmails={st.notifyEmails} leadAutoReply={st.leadAutoReply} />
        </Sheet>
      </div>
      <Notice kind="info" className="mt-5" title="La contraseña está protegida">Se guarda cifrada y nunca se vuelve a mostrar.</Notice>
    </>
  );
}
