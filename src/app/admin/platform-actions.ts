"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withSystem } from "@/lib/db";
import { requireAdmin, platformAudit } from "@/lib/auth/admin-session";
import { friendlyEmailError, parseEmailSettingsForm } from "@/lib/email/settings-form";
import { sendEmail } from "@/lib/email/provider";
import { loadPlatformTransport } from "@/lib/email/platform-config";
import { LEAD_STATUS } from "@/server/platform-leads";
import type { ActionState } from "@/lib/action-state";

// ---------------------------------------------------------------------------
// Solicitudes de demostración
// ---------------------------------------------------------------------------
const leadUpdate = z.object({
  id: z.string().uuid(),
  status: z.enum(Object.keys(LEAD_STATUS) as [keyof typeof LEAD_STATUS, ...(keyof typeof LEAD_STATUS)[]]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function updatePlatformLead(fd: FormData) {
  const s = await requireAdmin();
  const d = leadUpdate.parse(Object.fromEntries(fd));
  await withSystem(async (tx) => {
    const r = await tx.one<{ company: string }>(
      `update platform_leads set status = coalesce($2, status), notes = case when $3::boolean then nullif(trim($4), '') else notes end where id = $1 returning company`,
      [d.id, d.status ?? null, d.notes !== undefined, d.notes ?? null]);
    if (r) await platformAudit(tx, s, "solicitud.actualizar", { target: r.company, detail: d.status ? { status: d.status } : { notes: true } });
  });
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Correo de Webera
// ---------------------------------------------------------------------------
async function runPlatformTest(to: string): Promise<{ ok: boolean; error?: string }> {
  return withSystem(async (tx) => {
    const row = await tx.one<{ provider: "gmail" | "smtp" | "resend" | null; from_email: string | null }>(`select provider, from_email from platform_settings where id`);
    if (!row?.provider) return { ok: false, error: "No hay ningún correo conectado." };
    const transport = await loadPlatformTransport(tx);
    if (!transport) return { ok: false, error: "No se ha podido leer la configuración guardada. Vuelve a escribir la contraseña." };
    const r = await sendEmail({
      to, fromName: "Webera",
      subject: "Prueba de correo · Consola Webera",
      text: `Si estás leyendo esto, el correo de Webera funciona.\n\nDesde ${row.from_email} saldrán los avisos de nuevas solicitudes de demostración, la respuesta automática a los interesados y los avisos de las empresas que aún no han conectado su propio correo.`,
    }, transport);
    const ok = r.status === "accepted";
    const error = ok ? null : friendlyEmailError(r.error, row.provider);
    await tx.query(`update platform_settings set tested_at = now(), test_ok = $1, test_error = $2 where id`, [ok, error]);
    return ok ? { ok } : { ok, error: error ?? undefined };
  });
}

export async function savePlatformEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const existing = await withSystem((tx) => tx.one<{ provider: string | null; secret_enc: string | null; secret_hint: string | null }>(
    `select provider, secret_enc, secret_hint from platform_settings where id`));
  const parsed = parseEmailSettingsForm(fd, existing);
  if ("error" in parsed) return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  const v = parsed.values;
  await withSystem(async (tx) => {
    await tx.query(
      `update platform_settings set provider=$1, from_email=$2, smtp_host=$3, smtp_port=$4, smtp_secure=$5, smtp_user=$6, secret_enc=$7, secret_hint=$8,
         tested_at=null, test_ok=null, test_error=null where id`,
      [v.provider, v.from_email, v.smtp_host, v.smtp_port, v.smtp_secure, v.smtp_user, v.secret_enc, v.secret_hint]);
    await platformAudit(tx, s, "correo.conectar", { target: v.from_email, detail: { provider: v.provider } });
  });
  const t = await runPlatformTest(s.admin.email);
  revalidatePath("/admin/correo");
  if (!t.ok) return { error: `Guardado, pero el correo de prueba no ha salido: ${t.error}` };
  return { ok: true, message: `Conectado. Te hemos enviado un correo de prueba a ${s.admin.email}.` };
}

export async function sendPlatformTestEmail(): Promise<ActionState> {
  const s = await requireAdmin();
  const t = await runPlatformTest(s.admin.email);
  revalidatePath("/admin/correo");
  return t.ok ? { ok: true, message: `Enviado a ${s.admin.email}. Revisa tu bandeja (y la carpeta de spam).` } : { error: t.error };
}

export async function disconnectPlatformEmail(): Promise<void> {
  const s = await requireAdmin();
  await withSystem(async (tx) => {
    await tx.query(`update platform_settings set provider=null, from_email=null, smtp_host=null, smtp_port=null, smtp_user=null, secret_enc=null, secret_hint=null,
      tested_at=null, test_ok=null, test_error=null where id`);
    await platformAudit(tx, s, "correo.desconectar");
  });
  revalidatePath("/admin/correo");
}

export async function savePlatformNotify(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const list = String(fd.get("notify_emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const bad = list.find((e) => !z.string().email().safeParse(e).success);
  if (bad) return { error: `«${bad}» no es un email válido.`, fieldErrors: { notify_emails: `«${bad}» no es un email válido.` } };
  if (list.length > 10) return { error: "Como máximo 10 direcciones.", fieldErrors: { notify_emails: "Como máximo 10 direcciones." } };
  const autoReply = fd.get("lead_auto_reply") === "on";
  await withSystem(async (tx) => {
    await tx.query(`update platform_settings set notify_emails = $1, lead_auto_reply = $2 where id`, [[...new Set(list)], autoReply]);
    await platformAudit(tx, s, "correo.avisos", { detail: { notify: list.length, autoReply } });
  });
  revalidatePath("/admin/correo");
  return { ok: true, message: "Guardado." };
}
