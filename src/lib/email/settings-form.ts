import "server-only";
import { z } from "zod";
import { encryptSecret } from "../crypto";
import type { CompanyEmailProvider } from "./company-config";

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

export interface EmailSettingsValues {
  provider: CompanyEmailProvider; from_email: string; smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean;
  smtp_user: string | null; secret_enc: string; secret_hint: string | null;
}

/** Valida el formulario de correo de envío. Si no se escribe contraseña y el proveedor no cambia, conserva la guardada. */
export function parseEmailSettingsForm(
  fd: FormData, existing: { provider: string | null; secret_enc: string | null; secret_hint: string | null } | null,
): { values: EmailSettingsValues } | { error: string; fieldErrors?: Record<string, string> } {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) { const k = String(i.path[0] ?? "_"); if (!fe[k]) fe[k] = i.message; }
    return { error: parsed.error.issues[0].message, fieldErrors: fe };
  }
  const d = parsed.data;
  const secretIn = (d.secret ?? "").trim();
  const secret = d.provider === "gmail" ? secretIn.replace(/\s+/g, "") : secretIn;
  const keep = !secret && existing?.provider === d.provider && !!existing.secret_enc;
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
  return {
    values: {
      provider: d.provider, from_email: d.from_email, smtp_host: smtp.host, smtp_port: smtp.port, smtp_secure: smtp.secure, smtp_user: smtp.user,
      secret_enc: keep ? existing!.secret_enc! : encryptSecret(secret), secret_hint: keep ? existing!.secret_hint : secret.slice(-4),
    },
  };
}

/** Traduce los errores típicos de los servidores de correo a algo que se pueda resolver. */
export function friendlyEmailError(raw: string, provider: CompanyEmailProvider): string {
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
