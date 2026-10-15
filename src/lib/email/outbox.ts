import "server-only";
import type { Tx } from "../db";
import { withSystem } from "../db";
import { sendEmail } from "./provider";

export const MAX_ATTEMPTS = 5;
/** Espera antes de cada reintento (minutos): 1, 5, 30, 120, 360. */
export const BACKOFF_MIN = [1, 5, 30, 120, 360];

export interface EnqueueInput {
  to: string; subject: string; body: string; relatedType?: string; relatedId?: string | null; automationKey?: string | null;
}

/** Encola un email dentro de la transacción de la empresa. */
export async function enqueueEmail(tx: Tx, m: EnqueueInput): Promise<string> {
  const row = await tx.one<{ id: string }>(
    `insert into email_outbox(company_id, to_email, subject, body_text, related_type, related_id, automation_key)
     values (app_company_id(), $1, $2, $3, $4, $5, $6) returning id`,
    [m.to, m.subject.slice(0, 300), m.body.slice(0, 20000), m.relatedType ?? null, m.relatedId ?? null, m.automationKey ?? null],
  );
  return row!.id;
}

/**
 * Procesa la bandeja de salida: envía los emails pendientes cuyo momento ha llegado.
 * Usa FOR UPDATE SKIP LOCKED para que dos ejecuciones simultáneas no envíen dos veces.
 */
export async function processOutbox(opts: { companyId?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 25;
  const stats = { accepted: 0, failed: 0, retrying: 0, notConfigured: 0 };
  for (let i = 0; i < limit; i++) {
    const done = await withSystem(async (tx) => {
      const m = await tx.one<{ id: string; to_email: string; subject: string; body_text: string; attempts: number; company_name: string; reply_to: string | null }>(
        `select o.id, o.to_email, o.subject, o.body_text, o.attempts, c.name as company_name, c.email as reply_to
           from email_outbox o join companies c on c.id = o.company_id
          where o.status = 'pendiente' and o.next_attempt_at <= now() and ($1::uuid is null or o.company_id = $1::uuid)
          order by o.next_attempt_at limit 1 for update of o skip locked`, [opts.companyId ?? null]);
      if (!m) return false;
      const r = await sendEmail({ to: m.to_email, subject: m.subject, text: m.body_text, replyTo: m.reply_to, fromName: m.company_name });
      const attempts = m.attempts + 1;
      if (r.status === "accepted") {
        await tx.query(`update email_outbox set status='aceptado', provider=$2, provider_message_id=$3, attempts=$4, sent_at=now(), last_error=null where id=$1`, [m.id, r.provider, r.messageId, attempts]);
        stats.accepted++;
      } else if (r.status === "not_configured") {
        await tx.query(`update email_outbox set status='no_configurado', attempts=$2, last_error=$3 where id=$1`, [m.id, attempts, r.error]);
        stats.notConfigured++;
      } else if (r.retryable && attempts < MAX_ATTEMPTS) {
        await tx.query(`update email_outbox set attempts=$2, last_error=$3, provider=$4, next_attempt_at = now() + make_interval(mins => $5) where id=$1`,
          [m.id, attempts, r.error, r.provider, BACKOFF_MIN[attempts - 1] ?? 360]);
        stats.retrying++;
      } else {
        await tx.query(`update email_outbox set status='error', attempts=$2, last_error=$3, provider=$4 where id=$1`, [m.id, attempts, r.error, r.provider]);
        stats.failed++;
      }
      return true;
    });
    if (!done) break;
  }
  return stats;
}
