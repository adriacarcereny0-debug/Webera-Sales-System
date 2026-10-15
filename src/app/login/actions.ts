"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withSystem } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, userAgent } from "@/lib/request";
import type { ActionState } from "@/lib/action-state";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un email válido."),
  password: z.string().min(1, "Escribe tu contraseña.").max(200),
});

// Hash ficticio para igualar tiempos cuando el email no existe.
const DUMMY = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  const email = String(fd.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: { email } };

  const ip = await clientIp();
  const okIp = await rateLimit(`login:ip:${ip}`, 30, 900);
  const okEmail = await rateLimit(`login:email:${parsed.data.email}`, 8, 900);
  if (!okIp || !okEmail) {
    return { error: "Demasiados intentos. Espera unos minutos antes de volver a probar.", values: { email } };
  }

  const user = await withSystem((tx) =>
    tx.one<{ id: string; password_hash: string; active: boolean; company_active: boolean }>(
      `select u.id, u.password_hash, u.active, c.active as company_active from users u join companies c on c.id = u.company_id where u.email = $1`, [parsed.data.email]),
  );
  const valid = await verifyPassword(parsed.data.password, user?.password_hash ?? DUMMY).catch(() => false);
  if (!user || !valid || !user.active) {
    return { error: "El email o la contraseña no son correctos.", values: { email } };
  }
  if (!user.company_active) {
    return { error: "La cuenta de tu empresa está suspendida. Contacta con Webera.", values: { email } };
  }
  await createSession(user.id, ip, await userAgent());
  redirect("/panel");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
