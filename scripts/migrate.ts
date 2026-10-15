/**
 * Aplica las migraciones SQL de db/migrations en orden, una sola vez cada una.
 * Uso: DATABASE_URL=... npm run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const ssl = process.env.DATABASE_SSL === "true" || /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString: url, ssl });
  await client.connect();
  try {
    await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const done = new Set((await client.query<{ name: string }>(`select name from schema_migrations`)).rows.map((r) => r.name));
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = readFileSync(path.join(dir, f), "utf8");
      process.stdout.write(`Aplicando ${f}… `);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(`insert into schema_migrations(name) values ($1)`, [f]);
        await client.query("commit");
        console.log("hecho");
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
    console.log("Base de datos al día.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
