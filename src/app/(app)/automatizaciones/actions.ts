"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, tenant } from "@/lib/auth/session";
import { AUTOMATION_DEFAULTS, AUTOMATION_KEYS, type AutomationConfig } from "@/lib/company-defaults";
import { runAutomations } from "@/server/automations";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

const emailList = z.string().optional().transform((v, ctx) => {
  const list = (v ?? "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  for (const e of list) if (!z.string().email().safeParse(e).success) { ctx.addIssue({ code: "custom", message: `Email no válido: ${e}` }); return z.NEVER; }
  if (list.length > 10) { ctx.addIssue({ code: "custom", message: "Máximo 10 destinatarios." }); return z.NEVER; }
  return list;
});

const schema = z.object({
  key: z.enum(AUTOMATION_KEYS),
  enabled: z.string().optional(),
  days: z.coerce.number().int().min(1, "Mínimo 1 día").max(60, "Máximo 60 días").optional(),
  hours: z.coerce.number().int().min(1, "Mínimo 1 hora").max(240, "Máximo 240 horas").optional(),
  hoursBefore: z.coerce.number().int().min(1, "Mínimo 1 hora").max(168, "Máximo 168 horas").optional(),
  createTask: z.string().optional(),
  sendEmail: z.string().optional(),
  recipients: emailList,
});

export async function saveAutomation(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("automations.manage");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const base = AUTOMATION_DEFAULTS[d.key].config;
  const config: AutomationConfig = { ...base };
  if ("days" in base) config.days = d.days ?? base.days;
  if ("hours" in base) config.hours = d.hours ?? base.hours;
  if ("hoursBefore" in base) config.hoursBefore = d.hoursBefore ?? base.hoursBefore;
  if ("createTask" in base) config.createTask = d.createTask === "on";
  if ("sendEmail" in base) config.sendEmail = d.sendEmail === "on";
  if ("recipients" in base) config.recipients = d.recipients;
  await tenant(s, async (tx) => {
    await tx.query(
      `insert into automations(company_id, key, enabled, config) values (app_company_id(), $1, $2, $3)
       on conflict (company_id, key) do update set enabled = excluded.enabled, config = excluded.config`,
      [d.key, d.enabled === "on", JSON.stringify(config)]);
    await audit(tx, s, "automatizacion.guardar", "automation", null, { key: d.key, enabled: d.enabled === "on", config });
  });
  revalidatePath("/automatizaciones");
  return { ok: true, message: d.enabled === "on" ? "Guardada y activa." : "Guardada (desactivada)." };
}

export async function runNow(): Promise<ActionState> {
  const s = await requireCapability("automations.manage");
  const r = await runAutomations({ companyId: s.company.id });
  await tenant(s, (tx) => audit(tx, s, "automatizacion.ejecutar", "automation", null, { actions: r.actions, outbox: r.outbox, errors: r.errors.length }));
  revalidatePath("/automatizaciones");
  revalidatePath("/agenda");
  const total = Object.values(r.actions).reduce((a, b) => a + b, 0);
  const parts = [
    `${total} acción${total === 1 ? "" : "es"} ejecutada${total === 1 ? "" : "s"}`,
    `${r.outbox.accepted} email${r.outbox.accepted === 1 ? "" : "s"} aceptado${r.outbox.accepted === 1 ? "" : "s"} por el proveedor`,
  ];
  if (r.outbox.notConfigured) parts.push(`${r.outbox.notConfigured} sin enviar (email no configurado)`);
  if (r.outbox.retrying) parts.push(`${r.outbox.retrying} pendiente${r.outbox.retrying === 1 ? "" : "s"} de reintento`);
  if (r.errors.length) return { error: `${parts.join(", ")}. Errores: ${r.errors.slice(0, 3).join(" · ")}` };
  return { ok: true, message: parts.join(", ") + "." };
}

export async function retryEmail(fd: FormData) {
  const s = await requireCapability("automations.manage");
  const id = z.string().uuid().parse(fd.get("id"));
  await tenant(s, (tx) => tx.query(`update email_outbox set status = 'pendiente', next_attempt_at = now(), attempts = 0 where id = $1 and status in ('error','no_configurado')`, [id]));
  revalidatePath("/automatizaciones");
}

export async function discardEmail(fd: FormData) {
  const s = await requireCapability("automations.manage");
  const id = z.string().uuid().parse(fd.get("id"));
  await tenant(s, (tx) => tx.query(`update email_outbox set status = 'descartado' where id = $1 and status <> 'aceptado'`, [id]));
  revalidatePath("/automatizaciones");
}
