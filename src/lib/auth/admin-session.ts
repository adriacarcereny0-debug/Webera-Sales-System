import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withSystem, type Tx } from "../db";
import { env } from "../env";

/**
 * Sesiones del panel de plataforma (/admin). Totalmente separadas de las sesiones
 * de las empresas: otra tabla, otra cookie (limitada a /admin) y caducidad corta.
 */
export const ADMIN_COOKIE = "wss_admin";
const ADMIN_HOURS = 12;

export interface AdminSession {
  sessionId: string;
  admin: { id: string; name: string; email: string };
}

const hash = (t: string) => createHmac("sha256", env.sessionSecret).update(`admin:${t}`).digest("hex");

export async function createAdminSession(adminId: string, ip: string, ua: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + ADMIN_HOURS * 3600_000);
  await withSystem(async (tx) => {
    await tx.query(`insert into platform_sessions(admin_id, token_hash, expires_at, ip, user_agent) values ($1,$2,$3,$4,$5)`, [adminId, hash(token), expires, ip, ua]);
    await tx.query(`update platform_admins set last_login_at = now() where id = $1`, [adminId]);
    await tx.query(`delete from platform_sessions where expires_at < now()`);
  });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", expires,
  });
}

export async function destroyAdminSession() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await withSystem((tx) => tx.query(`delete from platform_sessions where token_hash = $1`, [hash(token)]));
  jar.set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
}

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await withSystem((tx) => tx.one<{ sid: string; id: string; name: string; email: string }>(
    `select s.id as sid, a.id, a.name, a.email from platform_sessions s join platform_admins a on a.id = s.admin_id and a.active
      where s.token_hash = $1 and s.expires_at > now()`, [hash(token)]));
  return row ? { sessionId: row.sid, admin: { id: row.id, name: row.name, email: row.email } } : null;
});

export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}

export async function platformAudit(tx: Tx, s: AdminSession, action: string, opts: { companyId?: string | null; target?: string | null; detail?: Record<string, unknown> } = {}) {
  await tx.query(`insert into platform_audit(admin_id, action, company_id, target, detail) values ($1,$2,$3,$4,$5)`,
    [s.admin.id, action, opts.companyId ?? null, opts.target ?? null, JSON.stringify(opts.detail ?? {})]);
}

export function adminPasswordProblem(pw: string): string | null {
  if (pw.length < 12) return "La contraseña de administrador debe tener al menos 12 caracteres.";
  if (pw.length > 200) return "La contraseña es demasiado larga.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Incluye al menos una letra y un número.";
  return null;
}
