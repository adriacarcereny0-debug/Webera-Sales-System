import { Client } from "pg";
import type { Q } from "../src/lib/company-defaults";

export async function connect(): Promise<Client> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const ssl = process.env.DATABASE_SSL === "true" || /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;
  const c = new Client({ connectionString: url, ssl });
  await c.connect();
  return c;
}

export function q(c: Client): Q {
  return { query: async (text, params) => (await c.query(text, params as unknown[])).rows };
}
