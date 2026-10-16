import "server-only";
import type { Tx } from "../db";
import { withSystem } from "../db";
import { decryptSecret } from "../crypto";
import { emailConfigStatus, type EmailTransport } from "./provider";

export type CompanyEmailProvider = "gmail" | "smtp" | "resend";

export const EMAIL_PROVIDER_LABELS: Record<CompanyEmailProvider, string> = {
  gmail: "Gmail o Google Workspace",
  smtp: "Correo de tu hosting (SMTP)",
  resend: "Resend",
};

/** Ajustes fijos de Gmail: la empresa solo pone su dirección y una contraseña de aplicación. */
export const GMAIL = { host: "smtp.gmail.com", port: 465, secure: true } as const;

interface Row {
  provider: CompanyEmailProvider; from_email: string; smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean;
  smtp_user: string | null; secret_enc: string; secret_hint: string | null; tested_at: string | null; test_ok: boolean | null; test_error: string | null;
}

/** Lo que se puede enseñar en pantalla: nunca incluye la contraseña ni la clave. */
export interface CompanyEmailStatus {
  own: null | {
    provider: CompanyEmailProvider; fromEmail: string; smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean; smtpUser: string | null;
    secretHint: string | null; testedAt: string | null; testOk: boolean | null; testError: string | null;
  };
  platformConfigured: boolean;
  sentThisMonth: number;
  /** Hay algún modo de enviar (correo propio o el de la plataforma). */
  canSend: boolean;
}

export function rowToTransport(r: Row): EmailTransport {
  const secret = decryptSecret(r.secret_enc);
  if (r.provider === "resend") return { kind: "resend", provider: "resend", apiKey: secret, from: r.from_email };
  if (r.provider === "gmail") return { kind: "smtp", provider: "gmail", ...GMAIL, user: r.from_email, pass: secret, from: r.from_email };
  return { kind: "smtp", provider: "smtp", host: r.smtp_host!, port: r.smtp_port ?? 587, secure: r.smtp_secure, user: r.smtp_user ?? r.from_email, pass: secret, from: r.from_email };
}

/** Transporte propio de la empresa, o null si no ha conectado ninguno. Solo en contexto de sistema. */
export async function loadCompanyTransport(tx: Tx, companyId: string): Promise<EmailTransport | null> {
  const r = await tx.one<Row>(`select * from company_email_settings where company_id = $1`, [companyId]);
  if (!r) return null;
  try { return rowToTransport(r); } catch { return null; }
}

export async function getCompanyEmailStatus(companyId: string): Promise<CompanyEmailStatus> {
  return withSystem(async (tx) => {
    const r = await tx.one<Row>(`select * from company_email_settings where company_id = $1`, [companyId]);
    const sent = await tx.one<{ n: number }>(
      `select count(*)::int as n from email_outbox where company_id = $1 and status = 'aceptado' and sent_at >= date_trunc('month', now())`, [companyId]);
    const platformConfigured = emailConfigStatus().configured || !!(await tx.one(`select 1 from platform_settings where id and provider is not null and secret_enc is not null`));
    return {
      own: r ? {
        provider: r.provider, fromEmail: r.from_email, smtpHost: r.smtp_host, smtpPort: r.smtp_port, smtpSecure: r.smtp_secure, smtpUser: r.smtp_user,
        secretHint: r.secret_hint, testedAt: r.tested_at, testOk: r.test_ok, testError: r.test_error,
      } : null,
      platformConfigured,
      sentThisMonth: sent?.n ?? 0,
      canSend: !!r || platformConfigured,
    };
  });
}
