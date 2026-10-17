import "server-only";
import type { Tx } from "../db";
import { withSystem } from "../db";
import { platformTransport, type EmailTransport } from "./provider";
import { rowToTransport, type CompanyEmailProvider } from "./company-config";

interface PlatformRow {
  provider: CompanyEmailProvider | null; from_email: string | null; smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean;
  smtp_user: string | null; secret_enc: string | null; secret_hint: string | null; tested_at: string | null; test_ok: boolean | null;
  test_error: string | null; notify_emails: string[]; lead_auto_reply: boolean;
}

/** Correo de Webora Studio: el conectado desde /admin o, si no hay, el de las variables del servidor. */
export async function loadPlatformTransport(tx: Tx): Promise<EmailTransport | null> {
  const r = await tx.one<PlatformRow>(`select * from platform_settings where id`);
  if (r?.provider && r.from_email && r.secret_enc) {
    try {
      return rowToTransport({ ...r, provider: r.provider, from_email: r.from_email, secret_enc: r.secret_enc });
    } catch { /* clave no descifrable: se usa el respaldo */ }
  }
  return platformTransport();
}

export async function getPlatformSettings() {
  return withSystem(async (tx) => {
    const r = await tx.one<PlatformRow>(`select * from platform_settings where id`);
    return {
      own: r?.provider && r.from_email ? {
        provider: r.provider, fromEmail: r.from_email, smtpHost: r.smtp_host, smtpPort: r.smtp_port, smtpSecure: r.smtp_secure, smtpUser: r.smtp_user,
        secretHint: r.secret_hint, testedAt: r.tested_at, testOk: r.test_ok, testError: r.test_error,
      } : null,
      envConfigured: !!platformTransport(),
      notifyEmails: r?.notify_emails ?? [],
      leadAutoReply: r?.lead_auto_reply ?? true,
    };
  });
}
