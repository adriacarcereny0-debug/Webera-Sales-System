import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

declare global {
  var __weberaPool: Pool | undefined;
}

function createPool() {
  const url = env.databaseUrl;
  return new Pool({
    connectionString: url,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
}

export function pool(): Pool {
  if (!globalThis.__weberaPool) globalThis.__weberaPool = createPool();
  return globalThis.__weberaPool;
}

export interface TenantContext {
  companyId: string;
  userId: string | null;
}

export type Tx = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
  client: PoolClient;
};

function wrap(client: PoolClient): Tx {
  return {
    client,
    async query<T extends QueryResultRow>(text: string, params?: unknown[]) {
      const r = await client.query<T>(text, params as unknown[]);
      return r.rows;
    },
    async one<T extends QueryResultRow>(text: string, params?: unknown[]) {
      const r = await client.query<T>(text, params as unknown[]);
      return r.rows[0] ?? null;
    },
  };
}

/**
 * Ejecuta `fn` dentro de una transacción con el rol restringido `webera_app`
 * y la empresa fijada. Todas las consultas quedan sujetas a las políticas RLS:
 * aunque una consulta olvidara filtrar por company_id, PostgreSQL no devolvería
 * ni modificaría filas de otra empresa.
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!ctx.companyId) throw new Error("Contexto de empresa vacío");
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("set local role webera_app");
    await client.query("select set_config('app.company_id', $1, true), set_config('app.user_id', $2, true)", [
      ctx.companyId,
      ctx.userId ?? "",
    ]);
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Contexto de sistema (propietario de las tablas, sin RLS). Uso restringido a:
 * autenticación, resolución pública de empresa por slug, límites de peticiones,
 * cron de automatizaciones y scripts de administración. No usar en pantallas.
 */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
