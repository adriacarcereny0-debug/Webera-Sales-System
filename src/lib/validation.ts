import { z } from "zod";
import { parseEuroToCents } from "./money";
import { madridLocalToDate } from "./dates";
import { SOURCES, STAGES } from "./stages";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);

export const optText = (max: number, msg = "Texto demasiado largo.") =>
  z.preprocess(blankToNull, z.string().max(max, msg).nullable().optional()).transform((v) => v ?? null);

export const optUuid = z.preprocess(blankToNull, z.string().uuid("Valor no válido.").nullable().optional()).transform((v) => v ?? null);

export const phoneSchema = z.preprocess(
  blankToNull,
  z.string()
    .max(30, "Teléfono demasiado largo.")
    .refine((v) => /^\+?[0-9 ()./-]{6,}$/.test(v) && v.replace(/\D/g, "").length >= 9 && v.replace(/\D/g, "").length <= 15, "Escribe un teléfono válido (9 cifras como mínimo).")
    .nullable()
    .optional(),
).transform((v) => v ?? null);

export const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toLowerCase()) : v),
  z.string().max(160).email("Escribe un email válido.").nullable().optional(),
).transform((v) => v ?? null);

export const postalCodeSchema = z.preprocess(blankToNull, z.string().regex(/^\d{5}$/, "El código postal tiene 5 cifras.").nullable().optional()).transform((v) => v ?? null);

export const euroSchema = z.preprocess(blankToNull, z.string().nullable().optional()).transform((v, ctx) => {
  if (!v) return null;
  const c = parseEuroToCents(v);
  if (c === null || c < 0) {
    ctx.addIssue({ code: "custom", message: "Escribe un importe válido, por ejemplo 4.500 o 4500,50." });
    return z.NEVER;
  }
  return c;
});

export const madridDateTimeSchema = z.preprocess(blankToNull, z.string().nullable().optional()).transform((v, ctx) => {
  if (!v) return null;
  const d = madridLocalToDate(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Fecha u hora no válida." });
    return z.NEVER;
  }
  return d;
});

export const contactSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre del contacto.").max(160, "Nombre demasiado largo."),
    company_name: optText(160),
    phone: phoneSchema,
    email: emailSchema,
    address: optText(200),
    city: optText(100),
    postal_code: postalCodeSchema,
    service_id: optUuid,
    source: z.enum(Object.keys(SOURCES) as [keyof typeof SOURCES, ...(keyof typeof SOURCES)[]], { message: "Elige el origen." }),
    owner_id: optUuid,
    estimated_amount: euroSchema,
    stage: z.enum(STAGES).optional(),
    next_action: optText(200),
    next_action_at: madridDateTimeSchema,
    timeframe: optText(40),
    description: optText(4000),
  })
  .refine((v) => v.phone || v.email, { message: "Indica al menos un teléfono o un email.", path: ["phone"] });

export type ContactInput = z.infer<typeof contactSchema>;

export const taskSchema = z.object({
  kind: z.enum(["tarea", "visita"]),
  title: z.string().trim().min(1, "Describe la tarea.").max(200),
  notes: optText(2000),
  due_at: madridDateTimeSchema.refine((v) => v !== null, "Indica fecha y hora."),
  duration_min: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(24 * 60).nullable().optional()),
  location: optText(200),
  contact_id: optUuid,
  assigned_to: optUuid,
});

export function slugify(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}
