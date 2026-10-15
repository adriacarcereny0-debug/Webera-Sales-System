import "server-only";
import nodemailer from "nodemailer";
import { env } from "../env";

export type SendResult =
  | { status: "accepted"; provider: string; messageId: string | null }
  | { status: "failed"; provider: string; error: string; retryable: boolean }
  | { status: "not_configured"; provider: "none"; error: string };

export function emailConfigStatus(): { configured: boolean; provider: string; problem?: string } {
  const p = env.email.provider;
  if (p === "none") return { configured: false, provider: "none", problem: "No hay proveedor de email configurado (EMAIL_PROVIDER)." };
  if (!env.email.from) return { configured: false, provider: p, problem: "Falta EMAIL_FROM (remitente verificado)." };
  if (p === "resend" && !env.email.resendApiKey) return { configured: false, provider: p, problem: "Falta RESEND_API_KEY." };
  if (p === "smtp" && (!env.email.smtp.host || !env.email.smtp.user || !env.email.smtp.pass)) return { configured: false, provider: p, problem: "Faltan SMTP_HOST, SMTP_USER o SMTP_PASS." };
  return { configured: true, provider: p };
}

/**
 * Envía un email de texto. "accepted" significa que el proveedor lo ha aceptado
 * para su envío; NO garantiza la entrega en el buzón del destinatario.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string; replyTo?: string | null; fromName?: string }): Promise<SendResult> {
  const cfg = emailConfigStatus();
  if (!cfg.configured) return { status: "not_configured", provider: "none", error: cfg.problem! };
  const from = msg.fromName ? `${msg.fromName.replace(/["<>]/g, "")} <${env.email.from!.replace(/^.*<|>$/g, "")}>` : env.email.from!;

  if (env.email.provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.email.resendApiKey}`, "Content-Type": "application/json" },
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
    const transport = nodemailer.createTransport({
      host: env.email.smtp.host, port: env.email.smtp.port, secure: env.email.smtp.secure,
      auth: { user: env.email.smtp.user, pass: env.email.smtp.pass }, connectionTimeout: 15_000, greetingTimeout: 10_000,
    });
    const info = await transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, replyTo: msg.replyTo || undefined });
    if (info.accepted?.length) return { status: "accepted", provider: "smtp", messageId: info.messageId ?? null };
    return { status: "failed", provider: "smtp", error: `Rechazado por el servidor: ${String(info.rejected?.join(", "))}`.slice(0, 500), retryable: false };
  } catch (e) {
    const err = e as { message?: string; responseCode?: number };
    // SMTP: 4xx = error temporal (reintentar), 5xx = rechazo permanente; sin código = fallo de red.
    const code = err.responseCode;
    return { status: "failed", provider: "smtp", error: (err.message ?? String(e)).slice(0, 500), retryable: !code || (code >= 400 && code < 500) };
  }
}
