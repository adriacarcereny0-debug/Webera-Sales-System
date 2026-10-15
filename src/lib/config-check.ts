import "server-only";

/** Comprueba la configuración mínima del servidor y devuelve un mensaje claro si falta algo. */
export function configProblem(): string | null {
  if (!process.env.DATABASE_URL?.trim()) return "El servidor todavía no está conectado a la base de datos (falta DATABASE_URL).";
  if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.trim().length ?? 0) < 32) {
    return "Falta configurar la clave de sesiones del servidor (SESSION_SECRET).";
  }
  return null;
}

/** Traduce errores técnicos de conexión a un mensaje comprensible. */
export function friendlyServerError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/DATABASE_URL|SESSION_SECRET/.test(msg)) return configProblem() ?? "Falta configuración en el servidor.";
  if (/relation .* does not exist/.test(msg)) return "La base de datos está conectada pero sin preparar: faltan las tablas (ejecuta las migraciones).";
  if (/ECONNREFUSED|ENOTFOUND|timeout|getaddrinfo|password authentication/i.test(msg)) return "No se puede conectar con la base de datos. Revisa DATABASE_URL.";
  return "No se ha podido completar el acceso por un error del servidor. Inténtalo de nuevo en un minuto.";
}
