import "server-only";
import { createHash } from "node:crypto";
import { withSystem } from "./db";

/**
 * Límite de peticiones por ventana fija, persistido en PostgreSQL para que
 * funcione igual con varias instancias serverless.
 * Devuelve true si la petición está permitida.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const hashed = createHash("sha256").update(key).digest("hex");
  const row = await withSystem((tx) =>
    tx.one<{ count: number }>(
      `insert into rate_limits(key, window_start, count) values ($1, now(), 1)
       on conflict (key) do update set
         count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
         window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
       returning count`,
      [hashed, windowSeconds],
    ),
  );
  return (row?.count ?? 0) <= limit;
}

export async function cleanupRateLimits(): Promise<void> {
  await withSystem((tx) => tx.query(`delete from rate_limits where window_start < now() - interval '1 day'`));
}
