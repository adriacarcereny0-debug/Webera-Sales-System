"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, tenant } from "@/lib/auth/session";
import { withSystem } from "@/lib/db";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { sendEmail } from "@/lib/email/provider";
import { rowToTransport, type CompanyEmailProvider } from "@/lib/email/company-config";
import { zodFieldErrors, type ActionState } from "@/lib/action-state";

const email = z.string().trim().toLowerCase().email("Escribe un email válido.").max(200);

const schema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("gmail"), from_email: email, secret: z.string().optional() }),
  z.object({
    provider: z.literal("smtp"), from_email: email, secret: z.string().optional(),
    smtp_host: z.string().trim().min(3, "Escribe el servidor de salida, por ejemplo smtp.tudominio.es").max(200).regex(/^[a-z0-9.-]+$/i, "Solo el nombre del servidor, sin http:// ni espacios."),
    smtp_port: z.coerce.number().int().min(1).max(65535).default(587),
    smtp_user: z.string().trim().max(200).optional(),
  }),
  z.object({ provider: z.literal("resend"), from_email: email, secret: z.string().optional() }),
], { error: "Elige cómo quieres enviar los correos." });

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
      subject: "Prueba de correo · Webera Sales System",
      text: `Si estás leyendo esto, el correo de envío de ${companyName} funciona.\n\nA partir de ahora los avisos de nuevas solicitudes, recordatorios de visitas y seguimientos de presupuestos saldrán desde ${row.from_email}.`,
    }, rowToTransport(row));
    const ok = r.status === "accepted";
    const error = ok ? null : friendly(r.error, row.provider);
    await tx.query(`update company_email_settings set tested_at = now(), test_ok = $2, test_error = $3 where company_id = $1`, [companyId, ok, error]);
    return ok ? { ok } : { ok, error: error ?? undefined };
  });
}

/** Traduce los errores típicos de los servidores de correo a algo que se pueda resolver. */
function friendly(raw: string, provider: CompanyEmailProvider): string {
  const e = raw.toLowerCase();
  if (provider === "gmail" && (e.includes("535") || e.includes("username and password not accepted") || e.includes("invalid login")))
    return "Gmail no acepta la contraseña. Tiene que ser una «contraseña de aplicación» de 16 letras (no la contraseña normal de tu Gmail) y la verificación en 2 pasos debe estar activada.";
  if (e.includes("535") || (e.includes("auth") && e.includes("fail")) || e.includes("invalid login"))
    return "El servidor no acepta el usuario o la contraseña. Revísalos con tu proveedor de correo.";
  if (provider === "resend" && (e.includes("401") || e.includes("api key")))
    return "Resend no acepta la clave. Copia de nuevo la API key (empieza por re_).";
  if (provider === "resend" && (e.includes("domain") || e.includes("verify") || e.includes("403")))
    return `Resend aún no deja enviar desde esta dirección: verifica tu dominio en Resend › Domains. Detalle: ${raw.slice(0, 160)}`;
  if (e.includes("enotfound") || e.includes("getaddrinfo")) return "No se encuentra el servidor de correo. Revisa el nombre del servidor de salida.";
  if (e.includes("timeout") || e.includes("econnrefused") || e.includes("etimedout"))
    return "El servidor de correo no responde. Revisa el servidor y el puerto (normalmente 465 o 587).";
  return raw.slice(0, 300);
}

export async function saveEmailSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const secretIn = (d.secret ?? "").trim();
  const secret = d.provider === "gmail" ? secretIn.replace(/\s+/g, "") : secretIn;

  const existing = await withSystem((tx) => tx.one<{ provider: string; secret_enc: string; secret_hint: string | null }>(
    `select provider, secret_enc, secret_hint from company_email_settings where company_id = $1`, [s.company.id]));
  const keep = !secret && existing?.provider === d.provider;
  if (!secret && !keep) {
    const what = d.provider === "resend" ? "la API key de Resend" : d.provider === "gmail" ? "la contraseña de aplicación" : "la contraseña del correo";
    return { error: `Falta ${what}.`, fieldErrors: { secret: `Escribe ${what}.` } };
  }
  if (secret && d.provider === "gmail" && !/^[a-z]{16}$/i.test(secret))
    return { error: "La contraseña de aplicación de Google son 16 letras.", fieldErrors: { secret: "Pega las 16 letras que te da Google (con o sin espacios)." } };
  if (secret && d.provider === "resend" && !/^re_[A-Za-z0-9_]{10,}$/.test(secret))
    return { error: "La API key de Resend empieza por re_.", fieldErrors: { secret: "Copia la clave completa desde Resend › API Keys." } };

  const smtp = d.provider === "smtp"
    ? { host: d.smtp_host.toLowerCase(), port: d.smtp_port, secure: d.smtp_port === 465, user: d.smtp_user?.trim() || d.from_email }
    : { host: null, port: null, secure: true, user: null };
  const secretEnc = keep ? existing!.secret_enc : encryptSecret(secret);
  const hint = keep ? existing!.secret_hint : secret.slice(-4);

  await withSystem((tx) => tx.query(
    `insert into company_email_settings(company_id, provider, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, secret_enc, secret_hint, updated_by, tested_at, test_ok, test_error)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,null,null)
     on conflict (company_id) do update set provider=excluded.provider, from_email=excluded.from_email, smtp_host=excluded.smtp_host,
       smtp_port=excluded.smtp_port, smtp_secure=excluded.smtp_secure, smtp_user=excluded.smtp_user, secret_enc=excluded.secret_enc,
       secret_hint=excluded.secret_hint, updated_by=excluded.updated_by, tested_at=null, test_ok=null, test_error=null`,
    [s.company.id, d.provider, d.from_email, smtp.host, smtp.port, smtp.secure, smtp.user, secretEnc, hint, s.user.id]));
  await tenant(s, (tx) => audit(tx, s, "correo.conectar", "company", s.company.id, { provider: d.provider, from: d.from_email }));

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
