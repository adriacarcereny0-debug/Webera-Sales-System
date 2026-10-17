"use server";
import { revalidatePath } from "next/cache";
import { requireCapability, tenant } from "@/lib/auth/session";
import { withSystem } from "@/lib/db";
import { audit } from "@/lib/audit";
import { friendlyEmailError, parseEmailSettingsForm } from "@/lib/email/settings-form";
import { sendEmail } from "@/lib/email/provider";
import { rowToTransport, type CompanyEmailProvider } from "@/lib/email/company-config";
import type { ActionState } from "@/lib/action-state";

interface StoredRow {
  provider: CompanyEmailProvider; from_email: string; smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean;
  smtp_user: string | null; secret_enc: string; secret_hint: string | null; tested_at: string | null; test_ok: boolean | null; test_error: string | null;
}

/** Envía el correo de prueba con la configuración guardada y anota el resultado. */
async function runTest(companyId: string, companyName: string, to: string): Promise<{ ok: boolean; error?: string }> {
  return withSystem(async (tx) => {
    const row = await tx.one<StoredRow>(`select * from company_email_settings where company_id = $1`, [companyId]);
    if (!row) return { ok: false, error: "No hay ningún correo conectado." };
    const r = await sendEmail({
      to, fromName: companyName,
      subject: "Prueba de correo · Webora Studio",
      text: `Si estás leyendo esto, el correo de envío de ${companyName} funciona.\n\nA partir de ahora los avisos de nuevas solicitudes, recordatorios de visitas y seguimientos de presupuestos saldrán desde ${row.from_email}.`,
    }, rowToTransport(row));
    const ok = r.status === "accepted";
    const error = ok ? null : friendlyEmailError(r.error, row.provider);
    await tx.query(`update company_email_settings set tested_at = now(), test_ok = $2, test_error = $3 where company_id = $1`, [companyId, ok, error]);
    return ok ? { ok } : { ok, error: error ?? undefined };
  });
}

export async function saveEmailSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const existing = await withSystem((tx) => tx.one<{ provider: string; secret_enc: string; secret_hint: string | null }>(
    `select provider, secret_enc, secret_hint from company_email_settings where company_id = $1`, [s.company.id]));
  const parsed = parseEmailSettingsForm(fd, existing);
  if ("error" in parsed) return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  const v = parsed.values;
  await withSystem((tx) => tx.query(
    `insert into company_email_settings(company_id, provider, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, secret_enc, secret_hint, updated_by, tested_at, test_ok, test_error)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,null,null)
     on conflict (company_id) do update set provider=excluded.provider, from_email=excluded.from_email, smtp_host=excluded.smtp_host,
       smtp_port=excluded.smtp_port, smtp_secure=excluded.smtp_secure, smtp_user=excluded.smtp_user, secret_enc=excluded.secret_enc,
       secret_hint=excluded.secret_hint, updated_by=excluded.updated_by, tested_at=null, test_ok=null, test_error=null`,
    [s.company.id, v.provider, v.from_email, v.smtp_host, v.smtp_port, v.smtp_secure, v.smtp_user, v.secret_enc, v.secret_hint, s.user.id]));
  await tenant(s, (tx) => audit(tx, s, "correo.conectar", "company", s.company.id, { provider: v.provider, from: v.from_email }));

  const t = await runTest(s.company.id, s.company.name, s.user.email);
  revalidatePath("/ajustes/correo");
  revalidatePath("/ajustes");
  revalidatePath("/automatizaciones");
  if (!t.ok) return { error: `Guardado, pero el correo de prueba no ha salido: ${t.error}` };
  return { ok: true, message: `Conectado. Te hemos enviado un correo de prueba a ${s.user.email}.` };
}

export async function sendTestEmail(): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const t = await runTest(s.company.id, s.company.name, s.user.email);
  revalidatePath("/ajustes/correo");
  return t.ok ? { ok: true, message: `Enviado a ${s.user.email}. Revisa tu bandeja (y la carpeta de spam).` } : { error: t.error };
}

export async function disconnectEmail(): Promise<void> {
  const s = await requireCapability("settings.manage");
  await withSystem((tx) => tx.query(`delete from company_email_settings where company_id = $1`, [s.company.id]));
  await tenant(s, (tx) => audit(tx, s, "correo.desconectar", "company", s.company.id));
  revalidatePath("/ajustes/correo");
  revalidatePath("/ajustes");
  revalidatePath("/automatizaciones");
}
