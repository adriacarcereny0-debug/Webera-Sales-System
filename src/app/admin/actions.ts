"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withSystem } from "@/lib/db";
import { createAdminSession, destroyAdminSession, requireAdmin, platformAudit, adminPasswordProblem } from "@/lib/auth/admin-session";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, userAgent } from "@/lib/request";
import { applyCompanyDefaults } from "@/lib/company-defaults";
import { clearCompanyData, seedDemoData } from "@/lib/demo/seed";
import { slugify } from "@/lib/validation";
import { isRole } from "@/lib/permissions";
import { zodFieldErrors, type ActionState } from "@/lib/action-state";
import type { Tx } from "@/lib/db";

export type CredentialState = ActionState & { credentials?: { email: string; password: string; mustChange: boolean; company?: string } };

const q = (tx: Tx) => ({ query: (t: string, p?: unknown[]) => tx.query(t, p) });
const DUMMY = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

// ---------------------------------------------------------------------------
// Acceso
// ---------------------------------------------------------------------------
export async function adminLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Escribe email y contraseña.", values: { email } };
  const ip = await clientIp();
  if (!(await rateLimit(`admin:ip:${ip}`, 10, 900)) || !(await rateLimit(`admin:email:${email}`, 5, 900))) {
    return { error: "Demasiados intentos. Espera 15 minutos.", values: { email } };
  }
  const a = await withSystem((tx) => tx.one<{ id: string; password_hash: string; active: boolean }>(`select id, password_hash, active from platform_admins where email = $1`, [email]));
  const ok = await verifyPassword(password, a?.password_hash ?? DUMMY).catch(() => false);
  if (!a || !ok || !a.active) return { error: "Credenciales no válidas.", values: { email } };
  await createAdminSession(a.id, ip, await userAgent());
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Contraseñas para clientes
// ---------------------------------------------------------------------------
function resolvePassword(fd: FormData): { password?: string; error?: string } {
  const mode = String(fd.get("password_mode") ?? "generar");
  if (mode === "generar") return { password: temporaryPassword() };
  const pw = String(fd.get("password") ?? "");
  const problem = passwordProblem(pw);
  return problem ? { error: problem } : { password: pw };
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------
const newCompanySchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto.").max(120),
  slug: z.string().trim().optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color #RRGGBB."),
  owner_name: z.string().trim().min(2, "Nombre del propietario.").max(100),
  owner_email: z.string().trim().toLowerCase().email("Email no válido."),
  plan_note: z.string().trim().max(300).optional(),
  sample_data: z.string().optional(),
});

export async function createCompany(_: CredentialState, fd: FormData): Promise<CredentialState> {
  const s = await requireAdmin();
  const parsed = newCompanySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const slug = slugify(d.slug || d.name).slice(0, 50);
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) return { error: "Identificador no válido.", fieldErrors: { slug: "Usa letras, números y guiones (3–50)." } };
  const pw = resolvePassword(fd);
  if (pw.error) return { error: pw.error, fieldErrors: { password: pw.error } };
  const mustChange = fd.get("must_change") === "on";
  const hashed = await hashPassword(pw.password!);
  const res = await withSystem(async (tx) => {
    if (await tx.one(`select 1 from companies where slug = $1`, [slug])) return { error: "Ya existe una empresa con ese identificador.", field: "slug" };
    if (await tx.one(`select 1 from users where email = $1`, [d.owner_email])) return { error: "Ese email ya tiene cuenta.", field: "owner_email" };
    const c = await tx.one<{ id: string }>(
      `insert into companies(slug, name, brand_color, email, notification_emails, plan_note) values ($1,$2,$3,$4,$5,$6) returning id`,
      [slug, d.name, d.brand_color.toLowerCase(), d.owner_email, [d.owner_email], d.plan_note || null]);
    await applyCompanyDefaults(q(tx), c!.id);
    const u = await tx.one<{ id: string }>(
      `insert into users(company_id, email, name, password_hash, role, must_change_password) values ($1,$2,$3,$4,'propietario',$5) returning id`,
      [c!.id, d.owner_email, d.owner_name, hashed, mustChange]);
    if (d.sample_data === "on") await seedDemoData(q(tx), c!.id, { owner: u!.id, s1: u!.id, s2: u!.id });
    await platformAudit(tx, s, "empresa.crear", { companyId: c!.id, target: slug, detail: { owner: d.owner_email, sample: d.sample_data === "on" } });
    return { id: c!.id };
  });
  if ("error" in res) return { error: res.error, fieldErrors: { [res.field ?? "name"]: res.error ?? "" } };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Empresa «${d.name}» creada.`, values: { id: res.id }, credentials: { email: d.owner_email, password: pw.password!, mustChange, company: d.name } };
}

const updateCompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, "Letras minúsculas, números y guiones."),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color #RRGGBB."),
  plan_note: z.string().trim().max(300).optional(),
  active: z.string().optional(),
});

export async function updateCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const parsed = updateCompanySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const err = await withSystem(async (tx) => {
    if (await tx.one(`select 1 from companies where slug = $1 and id <> $2`, [d.slug, d.id])) return "Ese identificador ya está en uso.";
    const r = await tx.one(`update companies set name=$2, slug=$3, brand_color=$4, plan_note=$5, active=$6 where id=$1 returning id`,
      [d.id, d.name, d.slug, d.brand_color.toLowerCase(), d.plan_note || null, d.active === "on"]);
    if (!r) return "Empresa no encontrada.";
    if (d.active !== "on") await tx.query(`delete from sessions where user_id in (select id from users where company_id = $1)`, [d.id]);
    await platformAudit(tx, s, "empresa.actualizar", { companyId: d.id, target: d.slug, detail: { active: d.active === "on" } });
    return null;
  });
  if (err) return { error: err };
  revalidatePath("/admin", "layout");
  return { ok: true, message: d.active === "on" ? "Empresa guardada." : "Empresa guardada y suspendida: sus usuarios ya no pueden entrar." };
}

export async function deleteCompany(fd: FormData) {
  const s = await requireAdmin();
  const id = z.string().uuid().parse(fd.get("id"));
  const confirm = String(fd.get("confirm") ?? "").trim();
  await withSystem(async (tx) => {
    const c = await tx.one<{ slug: string; name: string }>(`select slug, name from companies where id = $1`, [id]);
    if (!c || c.slug !== confirm) throw new Error("El identificador escrito no coincide; no se ha borrado nada.");
    await tx.query(`delete from quotes where company_id = $1`, [id]);
    await tx.query(`delete from companies where id = $1`, [id]);
    await platformAudit(tx, s, "empresa.eliminar", { target: c.slug, detail: { name: c.name } });
  });
  revalidatePath("/admin", "layout");
  redirect("/admin/empresas?aviso=eliminada");
}

export async function restoreCompanyDemo(fd: FormData) {
  const s = await requireAdmin();
  const id = z.string().uuid().parse(fd.get("id"));
  await withSystem(async (tx) => {
    const c = await tx.one<{ is_demo: boolean }>(`select is_demo from companies where id = $1`, [id]);
    if (!c?.is_demo) throw new Error("Solo se pueden restaurar empresas de demostración.");
    const users = await tx.query<{ id: string }>(`select id from users where company_id = $1 and active order by role = 'propietario' desc, created_at`, [id]);
    if (!users.length) throw new Error("La demo no tiene usuarios activos.");
    await clearCompanyData(q(tx), id);
    await seedDemoData(q(tx), id, { owner: users[0].id, s1: users[1]?.id ?? users[0].id, s2: users[2]?.id ?? users[0].id });
    await platformAudit(tx, s, "demo.restaurar", { companyId: id });
  });
  revalidatePath("/admin", "layout");
  redirect(`/admin/empresas/${id}?aviso=restaurada`);
}

// ---------------------------------------------------------------------------
// Usuarios de empresas
// ---------------------------------------------------------------------------
const newUserSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().trim().min(2, "Escribe el nombre.").max(100),
  email: z.string().trim().toLowerCase().email("Email no válido."),
  role: z.string().refine(isRole, "Rol no válido."),
});

export async function createCompanyUser(_: CredentialState, fd: FormData): Promise<CredentialState> {
  const s = await requireAdmin();
  const parsed = newUserSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Revisa los campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const pw = resolvePassword(fd);
  if (pw.error) return { error: pw.error, fieldErrors: { password: pw.error } };
  const mustChange = fd.get("must_change") === "on";
  const hashed = await hashPassword(pw.password!);
  const err = await withSystem(async (tx) => {
    if (await tx.one(`select 1 from users where email = $1`, [d.email])) return "Ese email ya tiene cuenta.";
    const c = await tx.one<{ name: string }>(`select name from companies where id = $1`, [d.company_id]);
    if (!c) return "Empresa no encontrada.";
    await tx.query(`insert into users(company_id, email, name, password_hash, role, must_change_password) values ($1,$2,$3,$4,$5,$6)`,
      [d.company_id, d.email, d.name, hashed, d.role, mustChange]);
    await platformAudit(tx, s, "usuario.crear", { companyId: d.company_id, target: d.email, detail: { role: d.role } });
    return null;
  });
  if (err) return { error: err, fieldErrors: err.includes("email") ? { email: err } : {} };
  revalidatePath(`/admin/empresas/${d.company_id}`);
  return { ok: true, message: "Usuario creado.", credentials: { email: d.email, password: pw.password!, mustChange } };
}

export async function setUserPassword(_: CredentialState, fd: FormData): Promise<CredentialState> {
  const s = await requireAdmin();
  const id = z.string().uuid().safeParse(fd.get("user_id"));
  if (!id.success) return { error: "Usuario no válido." };
  const pw = resolvePassword(fd);
  if (pw.error) return { error: pw.error, fieldErrors: { password: pw.error } };
  const mustChange = fd.get("must_change") === "on";
  const hashed = await hashPassword(pw.password!);
  const u = await withSystem(async (tx) => {
    const row = await tx.one<{ email: string; company_id: string }>(
      `update users set password_hash = $2, must_change_password = $3 where id = $1 returning email, company_id`, [id.data, hashed, mustChange]);
    if (!row) return null;
    await tx.query(`delete from sessions where user_id = $1`, [id.data]);
    await platformAudit(tx, s, "usuario.contrasena", { companyId: row.company_id, target: row.email, detail: { mustChange } });
    return row;
  });
  if (!u) return { error: "Usuario no encontrado." };
  revalidatePath(`/admin/empresas/${u.company_id}`);
  return { ok: true, message: "Contraseña actualizada. Se han cerrado sus sesiones abiertas.", credentials: { email: u.email, password: pw.password!, mustChange } };
}

const updateUserSchema = z.object({ user_id: z.string().uuid(), role: z.string().refine(isRole), active: z.string().optional(), name: z.string().trim().min(2).max(100) });

export async function updateCompanyUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const parsed = updateUserSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Datos no válidos." };
  const d = parsed.data;
  const active = d.active === "on";
  const err = await withSystem(async (tx) => {
    const cur = await tx.one<{ company_id: string; role: string; email: string }>(`select company_id, role, email from users where id = $1`, [d.user_id]);
    if (!cur) return "Usuario no encontrado.";
    if (cur.role === "propietario" && (d.role !== "propietario" || !active)) {
      const others = await tx.one<{ n: number }>(`select count(*)::int as n from users where company_id = $1 and role = 'propietario' and active and id <> $2`, [cur.company_id, d.user_id]);
      if ((others?.n ?? 0) === 0) return "La empresa debe conservar al menos un propietario activo.";
    }
    await tx.query(`update users set name = $2, role = $3, active = $4 where id = $1`, [d.user_id, d.name, d.role, active]);
    if (!active) await tx.query(`delete from sessions where user_id = $1`, [d.user_id]);
    await platformAudit(tx, s, "usuario.actualizar", { companyId: cur.company_id, target: cur.email, detail: { role: d.role, active } });
    return null;
  });
  if (err) return { error: err };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Usuario guardado." };
}

// ---------------------------------------------------------------------------
// Administradores de plataforma
// ---------------------------------------------------------------------------
export async function createPlatformAdmin(_: CredentialState, fd: FormData): Promise<CredentialState> {
  const s = await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (name.length < 2 || !z.string().email().safeParse(email).success) return { error: "Nombre y email válidos, por favor." };
  const password = temporaryPassword() + temporaryPassword().slice(0, 4);
  const hashed = await hashPassword(password);
  const err = await withSystem(async (tx) => {
    if (await tx.one(`select 1 from platform_admins where email = $1`, [email])) return "Ese email ya es administrador.";
    await tx.query(`insert into platform_admins(email, name, password_hash) values ($1,$2,$3)`, [email, name, hashed]);
    await platformAudit(tx, s, "admin.crear", { target: email });
    return null;
  });
  if (err) return { error: err };
  revalidatePath("/admin/equipo");
  return { ok: true, message: "Administrador creado.", credentials: { email, password, mustChange: false } };
}

export async function toggleAdmin(fd: FormData) {
  const s = await requireAdmin();
  const id = z.string().uuid().parse(fd.get("id"));
  if (id === s.admin.id) throw new Error("No puedes desactivarte a ti mismo.");
  await withSystem(async (tx) => {
    const r = await tx.one<{ email: string; active: boolean }>(`update platform_admins set active = not active where id = $1 returning email, active`, [id]);
    if (r && !r.active) await tx.query(`delete from platform_sessions where admin_id = $1`, [id]);
    await platformAudit(tx, s, "admin.estado", { target: r?.email, detail: { active: r?.active } });
  });
  revalidatePath("/admin/equipo");
}

export async function changeAdminPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("repeat") ?? "")) return { error: "Las contraseñas nuevas no coinciden." };
  const problem = adminPasswordProblem(next);
  if (problem) return { error: problem };
  const row = await withSystem((tx) => tx.one<{ password_hash: string }>(`select password_hash from platform_admins where id = $1`, [s.admin.id]));
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: "La contraseña actual no es correcta." };
  const hashed = await hashPassword(next);
  await withSystem(async (tx) => {
    await tx.query(`update platform_admins set password_hash = $2 where id = $1`, [s.admin.id, hashed]);
    await tx.query(`delete from platform_sessions where admin_id = $1 and id <> $2`, [s.admin.id, s.sessionId]);
    await platformAudit(tx, s, "admin.contrasena", { target: s.admin.email });
  });
  return { ok: true, message: "Contraseña cambiada. Tus otras sesiones se han cerrado." };
}
