import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/** Token firmado con la hora de carga del formulario (antispam por tiempo mínimo). */
export function issueFormToken(slug: string, now = Date.now()): string {
  const mac = createHmac("sha256", env.sessionSecret).update(`${slug}.${now}`).digest("base64url").slice(0, 32);
  return `${now}.${mac}`;
}

export function checkFormToken(slug: string, token: string, now = Date.now(), minMs = 3000, maxMs = 3 * 3600_000): "ok" | "rapido" | "invalido" {
  const [tsStr, mac] = token.split(".");
  const ts = Number(tsStr);
  if (!ts || !mac) return "invalido";
  const expected = createHmac("sha256", env.sessionSecret).update(`${slug}.${ts}`).digest("base64url").slice(0, 32);
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalido";
  if (now - ts < minMs) return "rapido";
  if (now - ts > maxMs) return "invalido";
  return "ok";
}
