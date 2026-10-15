import { z } from "zod";

export interface CustomField {
  key: string;
  label: string;
  type: "texto" | "numero" | "opcion" | "si_no";
  options?: string[];
}

export const customFieldsSchema = z
  .array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      label: z.string().trim().min(1).max(60),
      type: z.enum(["texto", "numero", "opcion", "si_no"]),
      options: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    }),
  )
  .max(12);

export function parseCustomFields(raw: unknown): CustomField[] {
  const r = customFieldsSchema.safeParse(raw);
  return r.success ? r.data : [];
}

/** Lee y valida los valores de campos personalizados de un FormData (prefijo cf_). */
export function readCustomValues(fields: CustomField[], fd: FormData): { values: Record<string, string | number | boolean>; errors: Record<string, string> } {
  const values: Record<string, string | number | boolean> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = fd.get(`cf_${f.key}`);
    const v = typeof raw === "string" ? raw.trim() : "";
    if (f.type === "si_no") {
      values[f.key] = raw === "on";
      continue;
    }
    if (v === "") continue;
    if (v.length > 300) { errors[`cf_${f.key}`] = "Texto demasiado largo."; continue; }
    if (f.type === "numero") {
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n)) errors[`cf_${f.key}`] = "Escribe un número.";
      else values[f.key] = n;
    } else if (f.type === "opcion") {
      if (!f.options?.includes(v)) errors[`cf_${f.key}`] = "Elige una opción de la lista.";
      else values[f.key] = v;
    } else {
      values[f.key] = v;
    }
  }
  return { values, errors };
}
