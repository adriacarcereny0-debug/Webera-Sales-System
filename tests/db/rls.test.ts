/**
 * Pruebas de aislamiento entre empresas contra PostgreSQL real.
 * Requiere TEST_DATABASE_URL apuntando a una base vacía con las migraciones aplicadas
 * (ver README). Se ejecuta con: npm run test:db
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("RLS: separación de datos entre empresas", () => {
  let db: Pool;
  let A: string, B: string, userA: string;

  async function asTenant<T>(company: string, fn: (q: (s: string, p?: unknown[]) => Promise<any[]>) => Promise<T>) {
    const c = await db.connect();
    try {
      await c.query("begin");
      await c.query("set local role webera_app");
      await c.query("select set_config('app.company_id', $1, true)", [company]);
      const r = await fn(async (s, p) => (await c.query(s, p as any[])).rows);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }

  beforeAll(async () => {
    db = new Pool({ connectionString: url });
    await db.query(`delete from companies where slug in ('rls-a','rls-b')`);
    A = (await db.query(`insert into companies(slug,name) values ('rls-a','Empresa A') returning id`)).rows[0].id;
    B = (await db.query(`insert into companies(slug,name) values ('rls-b','Empresa B') returning id`)).rows[0].id;
    userA = (await db.query(`insert into users(company_id,email,name,password_hash,role) values ($1,'rls-a@example.test','A','x','propietario') returning id`, [A])).rows[0].id;
    await db.query(`insert into users(company_id,email,name,password_hash,role) values ($1,'rls-b@example.test','B','x','propietario')`, [B]);
    await asTenant(A, (q) => q(`insert into contacts(company_id,name) values ($1,'Cliente de A')`, [A]));
    await asTenant(B, (q) => q(`insert into contacts(company_id,name) values ($1,'Cliente de B')`, [B]));
  });

  afterAll(async () => {
    await db.query(`delete from companies where slug in ('rls-a','rls-b')`);
    await db.end();
  });

  it("cada empresa solo ve sus contactos aunque la consulta no filtre", async () => {
    const rowsA = await asTenant(A, (q) => q(`select name from contacts where name like 'Cliente de %'`));
    expect(rowsA.map((r) => r.name)).toEqual(["Cliente de A"]);
    const rowsB = await asTenant(B, (q) => q(`select name from contacts where name like 'Cliente de %'`));
    expect(rowsB.map((r) => r.name)).toEqual(["Cliente de B"]);
  });

  it("no puede insertar datos en otra empresa", async () => {
    await expect(asTenant(A, (q) => q(`insert into contacts(company_id,name) values ($1,'Intruso')`, [B]))).rejects.toThrow(/row-level security/);
  });

  it("no puede modificar ni borrar filas de otra empresa", async () => {
    const upd = await asTenant(A, (q) => q(`update contacts set name='Hackeado' where company_id=$1 returning id`, [B]));
    expect(upd).toHaveLength(0);
    const del = await asTenant(A, (q) => q(`delete from contacts where company_id=$1 returning id`, [B]));
    expect(del).toHaveLength(0);
    const still = await db.query(`select name from contacts where company_id=$1`, [B]);
    expect(still.rows[0].name).toBe("Cliente de B");
  });

  it("solo ve su propia empresa", async () => {
    const rows = await asTenant(A, (q) => q(`select slug from companies where slug like 'rls-%'`));
    expect(rows.map((r) => r.slug)).toEqual(["rls-a"]);
  });

  it("sin empresa fijada no ve nada", async () => {
    const c = await db.connect();
    try {
      await c.query("begin");
      await c.query("set local role webera_app");
      const r = await c.query(`select count(*)::int as n from contacts`);
      expect(r.rows[0].n).toBe(0);
      await c.query("rollback");
    } finally {
      c.release();
    }
  });

  it("el rol de aplicación no puede leer hashes de contraseña ni sesiones", async () => {
    await expect(asTenant(A, (q) => q(`select password_hash from users`))).rejects.toThrow(/permission denied/);
    await expect(asTenant(A, (q) => q(`select * from sessions`))).rejects.toThrow(/permission denied/);
    const users = await asTenant(A, (q) => q(`select id from users`));
    expect(users.map((u) => u.id)).toEqual([userA]);
  });

  it("los folios son independientes por empresa", async () => {
    const a = await asTenant(A, (q) => q(`insert into contacts(company_id,name) values ($1,'Segundo A') returning folio`, [A]));
    const b = await asTenant(B, (q) => q(`insert into contacts(company_id,name) values ($1,'Segundo B') returning folio`, [B]));
    expect(Number(a[0].folio)).toBe(2);
    expect(Number(b[0].folio)).toBe(2);
  });
});
