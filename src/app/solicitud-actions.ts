"use server";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { checkFormToken } from "@/lib/form-token";
import { createPlatformLead, TEAM_SIZES, type TeamSize } from "@/server/platform-leads";
import { zodFieldErrors } from "@/lib/action-state";

export type DemoState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  company: z.string().trim().min(2, "Escribe el nombre de tu empresa.").max(160),
  email: z.string().trim().toLowerCase().email("Escribe un email válido.").max(200),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, "Teléfono no válido.").optional(),
  city: z.string().trim().max(100).optional(),
  team_size: z.enum(Object.keys(TEAM_SIZES) as [TeamSize, ...TeamSize[]]).optional().or(z.literal("")),
  message: z.string().trim().max(2000, "Máximo 2000 caracteres.").optional(),
  consent: z.literal("on", { message: "Necesitamos tu permiso para poder contestarte." }),
});

export async function requestDemo(_: DemoState, fd: FormData): Promise<DemoState> {
  const values: Record<string, string> = {};
  for (const k of ["name", "company", "email", "phone", "city", "team_size", "message"]) values[k] = String(fd.get(k) ?? "");
  // Antispam: campo trampa invisible y tiempo mínimo de cumplimentación.
  if (String(fd.get("website") ?? "") !== "") return { ok: true };
  const token = checkFormToken("webera-demo", String(fd.get("t") ?? ""));
  if (token === "invalido") return { error: "El formulario ha caducado. Recarga la página e inténtalo de nuevo.", values };
  if (token === "rapido") return { error: "Por favor, revisa los datos y vuelve a enviar.", values };
  if (!(await rateLimit(`demo:ip:${await clientIp()}`, 5, 600))) return { error: "Hemos recibido demasiadas solicitudes desde tu conexión. Inténtalo en unos minutos.", values };
  const parsed = schema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error.issues), values };
  const d = parsed.data;
  await createPlatformLead({
    name: d.name, company: d.company, email: d.email, phone: d.phone || null, city: d.city || null,
    teamSize: (d.team_size || null) as TeamSize | null, message: d.message || null, source: String(fd.get("source") ?? "").slice(0, 100) || null,
  });
  return { ok: true };
}
