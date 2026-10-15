"use server";
import { z } from "zod";
import { withSystem, withTenant } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { checkFormToken } from "@/lib/form-token";
import { sniffImage } from "@/lib/images";
import { emailSchema, phoneSchema, optUuid } from "@/lib/validation";
import { TIMEFRAMES } from "@/lib/stages";
import { padFolio } from "@/lib/brand";
import { notifyNewLead } from "@/server/automations";
import { processOutbox } from "@/lib/email/outbox";
import { zodFieldErrors } from "@/lib/action-state";

export type LeadState = { ok?: boolean; folio?: string; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const schema = z
  .object({
    name: z.string().trim().min(2, "Escribe tu nombre.").max(120, "Nombre demasiado largo."),
    phone: phoneSchema,
    email: emailSchema,
    location: z.string().trim().min(2, "Indica tu código postal o localidad.").max(100),
    service_id: optUuid,
    timeframe: z.enum(Object.keys(TIMEFRAMES) as [string, ...string[]]).optional().or(z.literal("")),
    description: z.string().trim().max(2000, "Máximo 2000 caracteres.").optional(),
    consent: z.literal("on", { message: "Necesitamos tu consentimiento para poder responderte." }),
  })
  .refine((v) => v.phone || v.email, { message: "Déjanos un teléfono o un email para poder contestarte.", path: ["phone"] });

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

export async function submitLead(slug: string, _: LeadState, fd: FormData): Promise<LeadState> {
  const values: Record<string, string> = {};
  for (const k of ["name", "phone", "email", "location", "service_id", "timeframe", "description"]) values[k] = String(fd.get(k) ?? "");

  // 1. Antispam: campo trampa invisible y tiempo mínimo de cumplimentación.
  if (String(fd.get("website") ?? "") !== "") return { ok: true, folio: "------" };
  const token = checkFormToken(slug, String(fd.get("t") ?? ""));
  if (token === "invalido") return { error: "El formulario ha caducado. Recarga la página e inténtalo de nuevo.", values };
  if (token === "rapido") return { error: "Por favor, revisa los datos y vuelve a enviar.", values };

  // 2. Límites de peticiones.
  const ip = await clientIp();
  if (!(await rateLimit(`lead:ip:${ip}`, 5, 600)) || !(await rateLimit(`lead:company:${slug}`, 120, 3600))) {
    return { error: "Hemos recibido demasiadas solicitudes desde tu conexión. Inténtalo de nuevo en unos minutos o llámanos.", values };
  }

  // 3. Validación.
  const parsed = schema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error.issues), values };
  const d = parsed.data;

  const company = await withSystem((tx) =>
    tx.one<{ id: string; form_enabled: boolean; form_photos_enabled: boolean }>(`select id, form_enabled, form_photos_enabled from companies where slug = $1 and active`, [slug]));
  if (!company || !company.form_enabled) return { error: "Este formulario no está disponible." };

  // 4. Fotos (solo si la empresa lo ha activado): tipo comprobado por contenido y tamaño máximo.
  const photos: { name: string; mime: string; data: Buffer }[] = [];
  if (company.form_photos_enabled) {
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_PHOTOS) return { error: `Puedes adjuntar como máximo ${MAX_PHOTOS} fotos.`, values };
    for (const f of files) {
      if (f.size > MAX_BYTES) return { error: `La foto «${f.name}» supera 5 MB.`, values };
      const data = Buffer.from(await f.arrayBuffer());
      const mime = sniffImage(data);
      if (!mime) return { error: `«${f.name}» no es una imagen JPG, PNG o WEBP válida.`, values };
      photos.push({ name: f.name.replace(/[^\w.\- ]/g, "_").slice(0, 100) || "foto", mime, data });
    }
  }

  const postal = /^\d{5}$/.test(d.location) ? d.location : null;
  const city = postal ? null : d.location;

  const folio = await withTenant({ companyId: company.id, userId: null }, async (tx) => {
    const serviceId = d.service_id && (await tx.one(`select 1 from services where id = $1 and active`, [d.service_id])) ? d.service_id : null;
    const row = await tx.one<{ id: string; folio: string }>(
      `insert into contacts(company_id, name, phone, email, city, postal_code, service_id, source, stage, timeframe, description, consent_at)
       values (app_company_id(), $1, $2, $3, $4, $5, $6, 'formulario_web', 'nuevo', $7, $8, now()) returning id, folio`,
      [d.name, d.phone, d.email, city, postal, serviceId, d.timeframe || null, d.description || null]);
    await tx.query(`insert into stage_history(company_id, contact_id, from_stage, to_stage) values (app_company_id(), $1, null, 'nuevo')`, [row!.id]);
    await tx.query(
      `insert into activities(company_id, contact_id, type, body, meta) values (app_company_id(), $1, 'formulario', $2, $3)`,
      [row!.id, "Solicitud recibida desde el formulario web.", JSON.stringify({ photos: photos.length, consent: "Política de privacidad aceptada en el formulario" })]);
    for (const p of photos) {
      await tx.query(`insert into attachments(company_id, contact_id, filename, mime, size_bytes, data) values (app_company_id(), $1, $2, $3, $4, $5)`,
        [row!.id, p.name, p.mime, p.data.length, p.data]);
    }
    await notifyNewLead(tx, row!.id);
    return row!.folio;
  });

  // 5. Intento de envío inmediato del aviso (si falla, queda en cola con reintentos).
  await processOutbox({ companyId: company.id, limit: 5 }).catch((e) => console.error("[formulario] envío inmediato", e));
  return { ok: true, folio: padFolio(folio) };
}
