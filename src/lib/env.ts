import "server-only";

/**
 * Acceso centralizado a variables de entorno del servidor.
 * Ninguna de estas variables lleva el prefijo NEXT_PUBLIC_, por lo que nunca
 * se incluyen en el código que llega al navegador.
 */
function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** APP_DATABASE_URL tiene prioridad: permite elegir la base de datos cuando la plataforma ya fija DATABASE_URL. */
function databaseUrl(): string | undefined {
  return optional("APP_DATABASE_URL") ?? optional("DATABASE_URL");
}

export const env = {
  get databaseUrl(): string {
    const v = databaseUrl();
    if (!v) throw new Error("Falta DATABASE_URL. Consulta el README (Variables de entorno).");
    return v;
  },
  get appUrl(): string {
    return (optional("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret(): string {
    const v = optional("SESSION_SECRET");
    if (!v || v.length < 32) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET debe tener al menos 32 caracteres en producción.");
      }
      return "dev-only-session-secret-change-me-0000000000";
    }
    return v;
  },
  get cronSecret(): string | undefined {
    return optional("CRON_SECRET");
  },
  email: {
    get provider(): "resend" | "smtp" | "none" {
      const p = optional("EMAIL_PROVIDER")?.toLowerCase();
      if (p === "resend" || p === "smtp") return p;
      return "none";
    },
    get from(): string | undefined {
      return optional("EMAIL_FROM");
    },
    get resendApiKey(): string | undefined {
      return optional("RESEND_API_KEY");
    },
    smtp: {
      get host() { return optional("SMTP_HOST"); },
      get port() { return Number(optional("SMTP_PORT") ?? "587"); },
      get user() { return optional("SMTP_USER"); },
      get pass() { return optional("SMTP_PASS"); },
      get secure() { return optional("SMTP_SECURE") === "true"; },
    },
  },
  get dbSsl(): boolean {
    const v = optional("DATABASE_SSL");
    if (v) return v === "true" || v === "require";
    const url = databaseUrl() ?? "";
    return /sslmode=require/.test(url);
  },
};
