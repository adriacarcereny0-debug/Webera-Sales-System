"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, requireSession, tenant, destroyOtherSessions } from "@/lib/auth/session";
import { withSystem } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "@/lib/auth/password";
import { sniffImage } from "@/lib/images";
import { customFieldsSchema } from "@/lib/custom-fields";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS } from "@/lib/company-defaults";
import { emailSchema, optText, phoneSchema, postalCodeSchema, slugify } from "@/lib/validation";
import { zodFieldErrors, type ActionState } from "@/lib/action-state";
import { isRole } from "@/lib/permissions";

const url = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().url("Escribe una dirección web completa (https://…).").max(300).nullable().optional()).transform((v) => v ?? null);

// ---------------------------------------------------------------------------
// Empresa y marca
// ---------------------------------------------------------------------------
const companySchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto.").max(120),
  legal_name: optText(160),
  tax_id: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim().toUpperCase() : v),
    z.string().regex(/^[A-Z0-9]{8,10}$/, "NIF/CIF con 9 caracteres, sin guiones.").nullable().optional()).transform((v) => v ?? null),
  email: emailSchema,
  phone: phoneSchema,
  website: url,
  address: optText(200),
  city: optText(100),
  postal_code: postalCodeSchema,
  province: optText(60),
  schedule: optText(300),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color en formato #RRGGBB."),
  notification_emails: z.string().optional().transform((v, ctx) => {
    const list = (v ?? "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    for (const e of list) if (!z.string().email().safeParse(e).success) { ctx.addIssue({ code: "custom", message: `Email no válido: ${e}` }); return z.NEVER; }
    return list.slice(0, 10);
  }),
  quote_prefix: z.string().trim().regex(/^[A-Za-z0-9]{1,6}$/, "Prefijo de 1 a 6 letras o números."),
  quote_validity_days: z.coerce.number().int().min(1).max(365),
  default_tax_rate: z.coerce.number().min(0).max(100),
  tax_rates: z.string().transform((v, ctx) => {
    const rates = [...new Set(v.split(/[,;\s]+/).filter(Boolean).map((x) => Number(x.replace(",", "."))))];
    if (!rates.length || rates.some((r) => !Number.isFinite(r) || r < 0 || r > 100)) { ctx.addIssue({ code: "custom", message: "Tipos de IVA separados por comas, entre 0 y 100." }); return z.NEVER; }
    return rates.sort((a, b) => b - a);
  }),
  quote_terms: optText(6000),
  quote_footer: optText(300),
});

export async function saveCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const parsed = companySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if (!d.tax_rates.includes(d.default_tax_rate)) return { error: "El IVA por defecto debe estar en la lista de tipos.", fieldErrors: { default_tax_rate: "No está en la lista." } };
  await tenant(s, async (tx) => {
    await tx.query(
      `update companies set name=$1, legal_name=$2, tax_id=$3, email=$4, phone=$5, website=$6, address=$7, city=$8, postal_code=$9,
         province=$10, schedule=$11, brand_color=$12, notification_emails=$13, quote_prefix=$14, quote_validity_days=$15,
         default_tax_rate=$16, tax_rates=$17, quote_terms=$18, quote_footer=$19 where id = app_company_id()`,
      [d.name, d.legal_name, d.tax_id, d.email, d.phone, d.website, d.address, d.city, d.postal_code, d.province, d.schedule,
        d.brand_color.toLowerCase(), d.notification_emails, d.quote_prefix.toUpperCase(), d.quote_validity_days, d.default_tax_rate,
        JSON.stringify(d.tax_rates), d.quote_terms, d.quote_footer]);
    await audit(tx, s, "empresa.actualizar", "company", s.company.id, { name: d.name, brand_color: d.brand_color });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Datos de la empresa guardados." };
}

export async function uploadLogo(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige un archivo de imagen." };
  if (file.size > 1024 * 1024) return { error: "El logotipo no puede superar 1 MB." };
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(data);
  if (!mime) return { error: "Formato no admitido. Usa PNG, JPG o WEBP (para el PDF, mejor PNG o JPG)." };
  await tenant(s, async (tx) => {
    await tx.query(`update companies set logo_data = $1, logo_mime = $2 where id = app_company_id()`, [data, mime]);
    await audit(tx, s, "empresa.logo", "company", s.company.id, { bytes: data.length, mime });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: mime === "image/webp" ? "Logotipo actualizado. Aviso: el PDF no admite WEBP; allí se mostrará el nombre." : "Logotipo actualizado." };
}

export async function removeLogo() {
  const s = await requireCapability("settings.manage");
  await tenant(s, async (tx) => {
    await tx.query(`update companies set logo_data = null, logo_mime = null where id = app_company_id()`);
    await audit(tx, s, "empresa.logo", "company", s.company.id, { removed: true });
  });
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------
const serviceSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nombre demasiado corto.").max(80),
  description: optText(300),
  sort: z.coerce.number().int().min(0).max(999).default(0),
  active: z.string().optional(),
});

export async function saveService(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const parsed = serviceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    await tenant(s, async (tx) => {
      if (d.id) await tx.query(`update services set name=$2, description=$3, sort=$4, active=$5 where id=$1`, [d.id, d.name, d.description, d.sort, d.active === "on"]);
      else await tx.query(`insert into services(company_id, name, description, sort, active) values (app_company_id(), $1, $2, $3, true)`, [d.name, d.description, d.sort]);
      await audit(tx, s, "servicio.guardar", "service", d.id || null, { name: d.name });
    });
  } catch (e) {
    if (String(e).includes("unique")) return { error: "Ya existe un servicio con ese nombre." };
    throw e;
  }
  revalidatePath("/ajustes/servicios");
  return { ok: true, message: d.id ? "Servicio actualizado." : "Servicio añadido." };
}

export async function deleteService(fd: FormData) {
  const s = await requireCapability("settings.manage");
  const id = z.string().uuid().parse(fd.get("id"));
  await tenant(s, async (tx) => {
    const used = await tx.one<{ n: number }>(`select count(*)::int as n from contacts where service_id = $1`, [id]);
    if (used && used.n > 0) await tx.query(`update services set active = false where id = $1`, [id]);
    else await tx.query(`delete from services where id = $1`, [id]);
    await audit(tx, s, "servicio.eliminar", "service", id, { deactivatedInstead: (used?.n ?? 0) > 0 });
  });
  revalidatePath("/ajustes/servicios");
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
const newUserSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre.").max(100),
  email: z.string().trim().toLowerCase().email("Email no válido.").max(160),
  role: z.string().refine(isRole, "Rol no válido."),
});

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("users.manage");
  const parsed = newUserSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Revisa los campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if (d.role === "propietario" && s.user.role !== "propietario") return { error: "Solo el propietario puede crear otro propietario." };
  const exists = await withSystem((tx) => tx.one(`select 1 from users where email = $1`, [d.email]));
  if (exists) return { error: "Ese email ya tiene una cuenta en Webera Sales System.", fieldErrors: { email: "Ya registrado." } };
  const pw = temporaryPassword();
  const hash = await hashPassword(pw);
  await tenant(s, async (tx) => {
    const row = await tx.one<{ id: string }>(
      `insert into users(company_id, email, name, password_hash, role, must_change_password) values (app_company_id(), $1, $2, $3, $4, true) returning id`,
      [d.email, d.name, hash, d.role]);
    await audit(tx, s, "usuario.crear", "user", row!.id, { email: d.email, role: d.role });
  });
  revalidatePath("/ajustes/usuarios");
  return { ok: true, message: `Usuario creado. Contraseña temporal (se muestra una sola vez): ${pw}`, values: { password: pw, email: d.email } };
}

const updateUserSchema = z.object({ id: z.string().uuid(), role: z.string().refine(isRole), active: z.string().optional() });

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("users.manage");
  const parsed = updateUserSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Datos no válidos." };
  const d = parsed.data;
  const active = d.active === "on";
  if (d.id === s.user.id && (!active || d.role !== s.user.role)) return { error: "No puedes cambiar tu propio rol ni desactivarte." };
  const res = await tenant(s, async (tx) => {
    const cur = await tx.one<{ role: string }>(`select role from users where id = $1`, [d.id]);
    if (!cur) return "Usuario no encontrado.";
    if ((cur.role === "propietario" || d.role === "propietario") && s.user.role !== "propietario") return "Solo el propietario puede cambiar a otro propietario.";
    const owners = await tx.one<{ n: number }>(`select count(*)::int as n from users where role = 'propietario' and active and id <> $1`, [d.id]);
    if (cur.role === "propietario" && (d.role !== "propietario" || !active) && (owners?.n ?? 0) === 0) return "Debe quedar al menos un propietario activo.";
    await tx.query(`update users set role = $2, active = $3 where id = $1`, [d.id, d.role, active]);
    await audit(tx, s, "usuario.actualizar", "user", d.id, { role: d.role, active });
    return null;
  });
  if (res) return { error: res };
  if (!active) await destroyOtherSessions(d.id, null);
  revalidatePath("/ajustes/usuarios");
  return { ok: true, message: "Usuario actualizado." };
}

export async function resetUserPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("users.manage");
  const id = z.string().uuid().parse(fd.get("id"));
  if (id === s.user.id) return { error: "Para cambiar tu contraseña usa «Mi cuenta»." };
  const pw = temporaryPassword();
  const hash = await hashPassword(pw);
  const ok = await tenant(s, async (tx) => {
    const r = await tx.one<{ id: string }>(`update users set password_hash = $2, must_change_password = true where id = $1 returning id`, [id, hash]);
    if (r) await audit(tx, s, "usuario.reset_password", "user", id);
    return !!r;
  });
  if (!ok) return { error: "Usuario no encontrado." };
  await destroyOtherSessions(id, null);
  revalidatePath("/ajustes/usuarios");
  return { ok: true, message: `Contraseña temporal (se muestra una sola vez): ${pw}` };
}

// ---------------------------------------------------------------------------
// Mi cuenta
// ---------------------------------------------------------------------------
export async function changeOwnPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession({ allowPasswordChange: true });
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const repeat = String(fd.get("repeat") ?? "");
  const problem = passwordProblem(next);
  if (problem) return { error: problem, fieldErrors: { next: problem } };
  if (next !== repeat) return { error: "Las contraseñas nuevas no coinciden.", fieldErrors: { repeat: "No coincide." } };
  const row = await withSystem((tx) => tx.one<{ password_hash: string }>(`select password_hash from users where id = $1`, [s.user.id]));
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: "La contraseña actual no es correcta.", fieldErrors: { current: "Incorrecta." } };
  if (current === next) return { error: "La nueva contraseña debe ser distinta de la actual." };
  const newHash = await hashPassword(next);
  await withSystem((tx) => tx.query(`update users set password_hash = $2, must_change_password = false where id = $1`, [s.user.id, newHash]));
  await destroyOtherSessions(s.user.id, s.sessionId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Contraseña actualizada. Se han cerrado tus otras sesiones." };
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------
const templateSchema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  subject: z.string().trim().min(3, "Asunto demasiado corto.").max(200),
  body: z.string().trim().min(10, "Texto demasiado corto.").max(5000),
});

export async function saveTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const parsed = templateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await tenant(s, async (tx) => {
    await tx.query(
      `insert into email_templates(company_id, key, name, subject, body) values (app_company_id(), $1, $4, $2, $3)
       on conflict (company_id, key) do update set subject = excluded.subject, body = excluded.body`,
      [parsed.data.key, parsed.data.subject, parsed.data.body, DEFAULT_TEMPLATES[parsed.data.key].name]);
    await audit(tx, s, "plantilla.guardar", "template", null, { key: parsed.data.key });
  });
  revalidatePath("/ajustes/plantillas");
  return { ok: true, message: "Plantilla guardada." };
}

// ---------------------------------------------------------------------------
// Formulario web
// ---------------------------------------------------------------------------
const formSchema = z.object({
  form_enabled: z.string().optional(),
  form_photos_enabled: z.string().optional(),
  form_intro: optText(400),
  form_thanks: optText(400),
  privacy_url: url,
  privacy_controller: optText(200),
});

export async function saveFormSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  const parsed = formSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  await tenant(s, async (tx) => {
    await tx.query(
      `update companies set form_enabled=$1, form_photos_enabled=$2, form_intro=$3, form_thanks=$4, privacy_url=$5, privacy_controller=$6 where id = app_company_id()`,
      [d.form_enabled === "on", d.form_photos_enabled === "on", d.form_intro, d.form_thanks, d.privacy_url, d.privacy_controller]);
    await audit(tx, s, "formulario.guardar", "company", s.company.id, { enabled: d.form_enabled === "on", photos: d.form_photos_enabled === "on" });
  });
  revalidatePath("/ajustes/formulario");
  return { ok: true, message: "Formulario guardado." };
}

// ---------------------------------------------------------------------------
// Campos personalizados
// ---------------------------------------------------------------------------
export async function saveCustomFields(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("settings.manage");
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("fields") ?? "[]")); } catch { return { error: "Datos no válidos." }; }
  const list = (raw as { label?: string; type?: string; options?: string; key?: string }[]).filter((f) => f.label?.trim());
  const used = new Set<string>();
  const fields = list.map((f) => {
    let key = f.key && /^[a-z][a-z0-9_]{0,39}$/.test(f.key) ? f.key : slugify(f.label!).replace(/-/g, "_").replace(/^[^a-z]+/, "").slice(0, 40) || "campo";
    while (used.has(key)) key = `${key}_2`.slice(0, 40);
    used.add(key);
    return { key, label: f.label!.trim(), type: f.type, ...(f.type === "opcion" ? { options: (f.options ?? "").split(",").map((o) => o.trim()).filter(Boolean) } : {}) };
  });
  const parsed = customFieldsSchema.safeParse(fields);
  if (!parsed.success) return { error: "Revisa los campos: máximo 12, nombre de hasta 60 caracteres, y las opciones separadas por comas." };
  if (parsed.data.some((f) => f.type === "opcion" && !f.options?.length)) return { error: "Los campos de tipo «Lista» necesitan al menos una opción." };
  await tenant(s, async (tx) => {
    await tx.query(`update companies set custom_fields = $1 where id = app_company_id()`, [JSON.stringify(parsed.data)]);
    await audit(tx, s, "campos.guardar", "company", s.company.id, { count: parsed.data.length });
  });
  revalidatePath("/ajustes/campos");
  return { ok: true, message: "Campos guardados." };
}
