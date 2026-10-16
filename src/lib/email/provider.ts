import "server-only";
import nodemailer from "nodemailer";
import { env } from "../env";

export type SendResult =
  | { status: "accepted"; provider: string; messageId: string | null }
  | { status: "failed"; provider: string; error: string; retryable: boolean }
  | { status: "not_configured"; provider: "none"; error: string };

/** Cómo se envía un email: el correo propio de la empresa o, si no tiene, el de la plataforma. */
export type EmailTransport =
  | { kind: "resend"; provider: "resend"; apiKey: string; from: string }
  | { kind: "smtp"; provider: "gmail" | "smtp"; host: string; port: number; secure: boolean; user: string; pass: string; from: string };

/** Correo de la plataforma (variables del servidor). Solo se usa si la empresa no ha conectado el suyo. */
export function emailConfigStatus(): { configured: boolean; provider: string; problem?: string } {
  const p = env.email.provider;
  if (p === "none") return { configured: false, provider: "none", problem: "No hay proveedor de email configurado (EMAIL_PROVIDER)." };
  if (!env.email.from) return { configured: false, provider: p, problem: "Falta EMAIL_FROM (remitente verificado)." };
  if (p === "resend" && !env.email.resendApiKey) return { configured: false, provider: p, problem: "Falta RESEND_API_KEY." };
  if (p === "smtp" && (!env.email.smtp.host || !env.email.smtp.user || !env.email.smtp.pass)) return { configured: false, provider: p, problem: "Faltan SMTP_HOST, SMTP_USER o SMTP_PASS." };
  return { configured: true, provider: p };
}

export function platformTransport(): EmailTransport | null {
  if (!emailConfigStatus().configured) return null;
  const from = env.email.from!;
  if (env.email.provider === "resend") return { kind: "resend", provider: "resend", apiKey: env.email.resendApiKey!, from };
  const smtp = env.email.smtp;
  return { kind: "smtp", provider: "smtp", host: smtp.host!, port: smtp.port, secure: smtp.secure, user: smtp.user!, pass: smtp.pass!, from };
}

/** Solo la dirección, sin nombre: «Nombre <a@b.c>» → «a@b.c». */
function bareAddress(from: string): string {
  return from.replace(/^.*<|>$/g, "").trim();
}

/**
 * Envía un email de texto. "accepted" significa que el proveedor lo ha aceptado
 * para su envío; NO garantiza la entrega en el buzón del destinatario.
 * Sin transporte explícito usa el correo de la plataforma.
 */
export async function sendEmail(
  msg: { to: string; subject: string; text: string; replyTo?: string | null; fromName?: string },
  transport?: EmailTransport | null,
): Promise<SendResult> {
  const t = transport ?? platformTransport();
  if (!t) return { status: "not_configured", provider: "none", error: "Sin correo de envío: conecta el de la empresa en Ajustes › Correo de envío." };
  const address = bareAddress(t.from);
  const from = msg.fromName ? `${msg.fromName.replace(/["<>]/g, "")} <${address}>` : t.from;

  if (t.kind === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${t.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, reply_to: msg.replyTo || undefined }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (res.ok && body.id) return { status: "accepted", provider: "resend", messageId: body.id };
      return { status: "failed", provider: "resend", error: `${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim().slice(0, 500), retryable: res.status === 429 || res.status >= 500 };
    } catch (e) {
      return { status: "failed", provider: "resend", error: e instanceof Error ? e.message : String(e), retryable: true };
    }
  }

  try {
    const transportSmtp = nodemailer.createTransport({
      host: t.host, port: t.port, secure: t.secure,
      auth: { user: t.user, pass: t.pass }, connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
    const info = await transportSmtp.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, replyTo: msg.replyTo || undefined });
    if (info.accepted?.length) return { status: "accepted", provider: t.provider, messageId: info.messageId ?? null };
    return { status: "failed", provider: t.provider, error: `Rechazado por el servidor: ${String(info.rejected?.join(", "))}`.slice(0, 500), retryable: false };
  } catch (e) {
    const err = e as { message?: string; responseCode?: number };
    // SMTP: 4xx = error temporal (reintentar), 5xx = rechazo permanente; sin código = fallo de red.
    const code = err.responseCode;
    return { status: "failed", provider: t.provider, error: (err.message ?? String(e)).slice(0, 500), retryable: !code || (code >= 400 && code < 500) };
  }
}
