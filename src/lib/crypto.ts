import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico para secretos guardados en la base de datos (claves de correo).
 * Clave: EMAIL_ENCRYPTION_KEY (recomendada, independiente) o, si falta, SESSION_SECRET.
 * Formato: v1.<iv>.<tag>.<datos>, todo en base64url.
 */
function key(): Buffer {
  const raw = process.env.EMAIL_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim();
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta EMAIL_ENCRYPTION_KEY (mínimo 32 caracteres).");
    return createHash("sha256").update("dev-only-email-key").digest();
  }
  return createHash("sha256").update(`webera-email:${raw}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, data] = enc.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Secreto con formato no válido.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
