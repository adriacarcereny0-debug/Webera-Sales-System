import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withSystem, withTenant, type Tx } from "../db";
import { env } from "../env";
import { can, type Capability, type Role } from "../permissions";

export const SESSION_COOKIE = "wss_session";
const SESSION_DAYS = 14;

export interface Session {
  sessionId: string;
  user: { id: string; name: string; email: string; role: Role; mustChangePassword: boolean };
  company: { id: string; name: string; slug: string; brandColor: string; isDemo: boolean; hasLogo: boolean };
}

function hashToken(token: string): string {
  return createHmac("sha256", env.sessionSecret).update(token).digest("hex");
}

export async function createSession(userId: string, ip: string, ua: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await withSystem(async (tx) => {
    await tx.query(
      `insert into sessions(user_id, token_hash, expires_at, ip, user_agent) values ($1,$2,$3,$4,$5)`,
      [userId, hashToken(token), expires, ip, ua],
    );
    await tx.query(`update users set last_login_at = now() where id = $1`, [userId]);
    await tx.query(`delete from sessions where expires_at < now()`);
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await withSystem((tx) => tx.query(`delete from sessions where token_hash = $1`, [hashToken(token)]));
  }
  jar.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string, keepSessionId: string | null): Promise<void> {
  await withSystem((tx) =>
    tx.query(`delete from sessions where user_id = $1 and ($2::uuid is null or id <> $2::uuid)`, [userId, keepSessionId]),
  );
}

export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await withSystem((tx) =>
    tx.one<{
      session_id: string; user_id: string; name: string; email: string; role: Role; must_change_password: boolean;
      company_id: string; company_name: string; slug: string; brand_color: string; is_demo: boolean; has_logo: boolean;
    }>(
      `select s.id as session_id, u.id as user_id, u.name, u.email, u.role, u.must_change_password,
              c.id as company_id, c.name as company_name, c.slug, c.brand_color, c.is_demo,
              (c.logo_data is not null) as has_logo
         from sessions s
         join users u on u.id = s.user_id and u.active
         join companies c on c.id = u.company_id and c.active
        where s.token_hash = $1 and s.expires_at > now()`,
      [hashToken(token)],
    ),
  );
  if (!row) return null;
  return {
    sessionId: row.session_id,
    user: { id: row.user_id, name: row.name, email: row.email, role: row.role, mustChangePassword: row.must_change_password },
    company: {
      id: row.company_id, name: row.company_name, slug: row.slug, brandColor: row.brand_color,
      isDemo: row.is_demo, hasLogo: row.has_logo,
    },
  };
});

/** Exige sesión válida; si no existe, redirige al acceso. */
export async function requireSession(opts: { allowPasswordChange?: boolean } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.mustChangePassword && !opts.allowPasswordChange) redirect("/cuenta?cambio=obligatorio");
  return s;
}

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para realizar esta acción.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Exige un permiso concreto. Para uso en acciones de servidor y rutas. */
export async function requireCapability(cap: Capability): Promise<Session> {
  const s = await requireSession();
  if (!can(s.user.role, cap)) throw new ForbiddenError();
  return s;
}

/** Ejecuta consultas en el contexto RLS de la empresa de la sesión. */
export function tenant<T>(s: Session, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant({ companyId: s.company.id, userId: s.user.id }, fn);
}
