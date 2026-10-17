import "server-only";
import { withSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/provider";
import { loadPlatformTransport } from "@/lib/email/platform-config";

export const TEAM_SIZES = { "1": "Solo yo", "2-5": "De 2 a 5 personas", "6-15": "De 6 a 15 personas", "16+": "Más de 15 personas" } as const;
export type TeamSize = keyof typeof TEAM_SIZES;

export const LEAD_STATUS = {
  nueva: { label: "Nueva", tint: "tint-amarilla" },
  contactada: { label: "Contactada", tint: "tint-azul" },
  alta: { label: "Dada de alta", tint: "tint-verde" },
  descartada: { label: "Descartada", tint: "tint-gris" },
} as const;
export type LeadStatus = keyof typeof LEAD_STATUS;

export interface NewLead { name: string; company: string; email: string; phone: string | null; city: string | null; teamSize: TeamSize | null; message: string | null; source: string | null }

/**
 * Guarda la solicitud de un instalador interesado y, si hay correo de Webora Studio, avisa al equipo
 * y le contesta al interesado. Si el correo falla, la solicitud queda guardada igualmente en /admin.
 */
export async function createPlatformLead(l: NewLead) {
  const { id, transport, notify, autoReply } = await withSystem(async (tx) => {
    const row = await tx.one<{ id: string }>(
      `insert into platform_leads(name, company, email, phone, city, team_size, message, source, consent_at) values ($1,$2,$3,$4,$5,$6,$7,$8,now()) returning id`,
      [l.name, l.company, l.email, l.phone, l.city, l.teamSize, l.message, l.source]);
    const st = await tx.one<{ notify_emails: string[]; lead_auto_reply: boolean }>(`select notify_emails, lead_auto_reply from platform_settings where id`);
    const admins = (await tx.query<{ email: string }>(`select email from platform_admins where active`)).map((a) => a.email);
    return { id: row!.id, transport: await loadPlatformTransport(tx), notify: st?.notify_emails?.length ? st.notify_emails : admins, autoReply: st?.lead_auto_reply ?? true };
  });
  if (!transport) return { id, emailed: false };

  const lines = [
    `${l.name} (${l.company}) ha pedido una demostración de Webora Studio.`,
    `Email: ${l.email}`, l.phone ? `Teléfono: ${l.phone}` : null, l.city ? `Localidad: ${l.city}` : null,
    l.teamSize ? `Equipo: ${TEAM_SIZES[l.teamSize]}` : null, l.message ? `\nMensaje:\n${l.message}` : null,
    `\nVer y dar de alta: ${env.appUrl}/admin/solicitudes`,
  ].filter(Boolean).join("\n");
  const results = await Promise.allSettled([
    ...notify.map((to) => sendEmail({ to, subject: `Nueva solicitud de demo: ${l.company}${l.city ? ` (${l.city})` : ""}`, text: lines, replyTo: l.email, fromName: "Webora Studio" }, transport)),
    ...(autoReply ? [sendEmail({
      to: l.email, fromName: "Webora Studio",
      subject: "Hemos recibido tu solicitud · Webora Studio",
      text: `Hola, ${l.name.split(" ")[0]}:\n\nGracias por tu interés en Webora Studio. Hemos recibido tu solicitud para ${l.company}.\n\n` +
        `Te escribiremos o te llamaremos muy pronto para enseñarte cómo funciona con ejemplos de tu día a día y resolver tus dudas.\n\n` +
        `Si quieres adelantarnos algo, responde a este correo.\n\nUn saludo,\nWebora Studio`,
    }, transport)] : []),
  ]);
  for (const r of results) if (r.status === "rejected" || (r.status === "fulfilled" && r.value.status !== "accepted")) console.error("[solicitudes] correo", r.status === "fulfilled" ? r.value : r.reason);
  return { id, emailed: true };
}
