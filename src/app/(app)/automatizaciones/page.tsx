import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AUTOMATION_DEFAULTS, AUTOMATION_KEYS, type AutomationConfig, type AutomationKey } from "@/lib/company-defaults";
import { getCompanyEmailStatus, EMAIL_PROVIDER_LABELS } from "@/lib/email/company-config";
import { env } from "@/lib/env";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader, Notice, EmptyState } from "@/components/ui/misc";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { AutomationForm, RunNowForm } from "./forms";
import { discardEmail, retryEmail } from "./actions";

export const metadata: Metadata = { title: "Automatizaciones" };

const OUTBOX_STATUS: Record<string, { label: string; tint: string }> = {
  pendiente: { label: "En cola", tint: "tint-amarilla" },
  aceptado: { label: "Aceptado por el proveedor", tint: "tint-verde" },
  error: { label: "Error", tint: "tint-rosa" },
  no_configurado: { label: "No enviado: email sin configurar", tint: "tint-gris" },
  descartado: { label: "Descartado", tint: "tint-gris" },
};

export default async function AutomationsPage() {
  const s = await requireSession();
  const canManage = can(s.user.role, "automations.manage");
  const { autos, runs, outbox } = await tenant(s, async (tx) => ({
    autos: await tx.query<{ key: AutomationKey; enabled: boolean; config: AutomationConfig; updated_at: string }>(`select key, enabled, config, updated_at from automations`),
    runs: await tx.query<{ automation_key: AutomationKey; status: string; detail: string | null; created_at: string }>(
      `select automation_key, status, detail, created_at from automation_runs order by created_at desc limit 30`),
    outbox: await tx.query<{ id: string; to_email: string; subject: string; status: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null; next_attempt_at: string; provider: string | null }>(
      `select id, to_email, subject, status, attempts, last_error, created_at, sent_at, next_attempt_at, provider from email_outbox order by created_at desc limit 30`),
  }));
  const byKey = Object.fromEntries(autos.map((a) => [a.key, a]));
  const email = await getCompanyEmailStatus(s.company.id);

  return (
    <>
      <PageHeader
        title="Automatizaciones"
        description="Avisos y tareas que el sistema crea solo. Cada una se puede activar o desactivar, y todo lo que hace queda registrado abajo."
        actions={canManage ? <RunNowForm /> : undefined}
      />

      {email.own ? (
        <Notice kind="ok" className="mb-5" title={`Los avisos salen desde ${email.own.fromEmail}`}>
          {EMAIL_PROVIDER_LABELS[email.own.provider]} · {email.sentThisMonth} enviados este mes. «Aceptado» significa que tu proveedor de correo ha admitido el mensaje; no confirma que haya llegado al buzón.
        </Notice>
      ) : email.platformConfigured ? (
        <Notice kind="ok" className="mb-5" title="Los avisos salen desde el correo general de Webera">
          Puedes enviarlos desde tu propio correo en <Link className="underline" href="/ajustes/correo">Ajustes › Correo de envío</Link>.
        </Notice>
      ) : (
        <Notice kind="warn" className="mb-5" title="Los avisos todavía no llegan por email">
          Las tareas automáticas sí se crean, pero los correos quedan como «No enviado».{" "}
          {canManage ? <>Conecta tu correo en <Link className="underline" href="/ajustes/correo">Ajustes › Correo de envío</Link> (1 minuto con Gmail).</> : "Pide a un administrador que conecte el correo de la empresa."}
        </Notice>
      )}
      {!env.cronSecret && (
        <Notice kind="warn" className="mb-5" title="Ejecución programada sin configurar">
          Falta CRON_SECRET: los recordatorios periódicos solo se ejecutarán con el botón «Ejecutar ahora». El aviso de nueva solicitud funciona igualmente al instante.
        </Notice>
      )}

      <Sheet className="mb-6">
        <ol className="divide-y divide-rule">
          {AUTOMATION_KEYS.map((k) => {
            const d = AUTOMATION_DEFAULTS[k];
            const a = byKey[k];
            return (
              <li key={k} className="grid-cols-1 grid gap-5 px-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:px-6">
                <div>
                  <h2 className="font-semibold text-ink">{d.title}</h2>
                  <p className="mt-1 max-w-[52ch] text-[0.88rem] text-muted text-pretty">{d.description}</p>
                  {k === "aviso_nueva_solicitud" && <p className="mt-2 text-[0.8rem] text-muted">Se dispara al instante al recibir la solicitud.</p>}
                  {k !== "aviso_nueva_solicitud" && <p className="mt-2 text-[0.8rem] text-muted">Se comprueba en cada ejecución programada o al pulsar «Ejecutar ahora». No se repite para el mismo caso.</p>}
                </div>
                <AutomationForm k={k} title={d.title} enabled={a?.enabled ?? false} config={{ ...d.config, ...(a?.config ?? {}) }} canManage={canManage} />
              </li>
            );
          })}
        </ol>
      </Sheet>

      <div className="grid-cols-1 grid items-start gap-5 xl:grid-cols-2">
        <Sheet>
          <SheetHeader title="Emails generados" description="Últimos 30. Con reintentos automáticos (hasta 5) si el proveedor falla de forma temporal." />
          {outbox.length === 0 ? <EmptyState title="Aún no se ha generado ningún email" /> : (
            <ul className="divide-y divide-rule">
              {outbox.map((o) => {
                const st = OUTBOX_STATUS[o.status] ?? { label: o.status, tint: "tint-gris" };
                return (
                  <li key={o.id} className="px-4 py-3 md:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[0.88rem] font-medium">{o.subject}</p>
                      <Chip tint={st.tint}>{st.label}</Chip>
                    </div>
                    <p className="mt-0.5 text-[0.78rem] text-muted">
                      Para {o.to_email} · {fmtDateTime(o.created_at)}
                      {o.sent_at && ` · aceptado ${fmtDateTime(o.sent_at)}`}
                      {o.status === "pendiente" && o.attempts > 0 && ` · intento ${o.attempts}, siguiente ${fmtDateTime(o.next_attempt_at)}`}
                    </p>
                    {o.last_error && o.status !== "aceptado" && <p className="mt-1 text-[0.78rem] break-words text-danger">{o.last_error}</p>}
                    {canManage && (o.status === "error" || o.status === "no_configurado") && (
                      <div className="mt-2 flex gap-3 text-[0.8rem]">
                        <form action={retryEmail}><input type="hidden" name="id" value={o.id} /><button className="font-medium text-brand hover:underline">Reintentar</button></form>
                        <form action={discardEmail}><input type="hidden" name="id" value={o.id} /><button className="text-muted hover:underline">Descartar</button></form>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
        <Sheet>
          <SheetHeader title="Registro de ejecuciones" description="Cada acción automática, una sola vez por caso." />
          {runs.length === 0 ? <EmptyState title="Sin ejecuciones todavía" /> : (
            <ul className="divide-y divide-rule">
              {runs.map((r, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3 md:px-5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.status === "error" ? "bg-danger" : "bg-ok")} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[0.86rem]">{AUTOMATION_DEFAULTS[r.automation_key]?.title ?? r.automation_key}</p>
                    <p className={cn("text-[0.78rem]", r.status === "error" ? "text-danger" : "text-muted")}>
                      {r.status === "error" ? `Error: ${r.detail}` : r.detail} · {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      </div>
    </>
  );
}
