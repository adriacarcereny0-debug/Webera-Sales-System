/**
 * Automatizaciones contra PostgreSQL real: crean tareas y emails una sola vez
 * por caso y nunca marcan un email como enviado sin proveedor configurado.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("automatizaciones", () => {
  let db: Pool;
  let companyId: string;
  let runAutomations: typeof import("@/server/automations").runAutomations;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.EMAIL_PROVIDER;
    db = new Pool({ connectionString: url });
    await db.query(`delete from companies where slug = 'auto-test'`);
    companyId = (await db.query(`insert into companies(slug, name) values ('auto-test','Automatizaciones Test') returning id`)).rows[0].id;
    const { applyCompanyDefaults } = await import("@/lib/company-defaults");
    await applyCompanyDefaults({ query: async (t, p) => (await db.query(t, p as unknown[])).rows }, companyId);
    const owner = (await db.query(`insert into users(company_id,email,name,password_hash,role) values ($1,'auto-owner@example.test','Dueña','x','propietario') returning id`, [companyId])).rows[0].id;
    const contact = (await db.query(`insert into contacts(company_id,name,phone,owner_id,stage) values ($1,'Cliente Seguimiento','600000001',$2,'presupuesto_enviado') returning id`, [companyId, owner])).rows[0].id;
    await db.query(
      `insert into quotes(company_id, contact_id, number, code, status, issue_date, valid_until, sent_at, created_by, subtotal_cents, tax_cents, total_cents)
       values ($1,$2,1,'P-T-0001','enviado', current_date - 6, current_date + 24, now() - interval '5 days', $3, 100000, 21000, 121000)`, [companyId, contact, owner]);
    await db.query(`insert into contacts(company_id,name,phone,stage,created_at) values ($1,'Lead Olvidado','600000002','nuevo', now() - interval '6 hours')`, [companyId]);
    await db.query(`insert into tasks(company_id, kind, title, due_at, assigned_to) values ($1,'visita','Visita técnica', now() + interval '3 hours', $2)`, [companyId, owner]);
    await db.query(`update automations set enabled = true where company_id = $1`, [companyId]);
    ({ runAutomations } = await import("@/server/automations"));
  });

  afterAll(async () => {
    await db.query(`delete from companies where slug = 'auto-test'`);
    await db.end();
    const { pool } = await import("@/lib/db");
    await pool().end();
  });

  it("ejecuta cada automatización una vez y registra el resultado", async () => {
    const r1 = await runAutomations({ companyId });
    expect(r1.actions.seguimiento_presupuesto).toBe(1);
    expect(r1.actions.tarea_contacto_nuevo).toBe(1);
    expect(r1.actions.recordatorio_visita).toBe(1);
    expect(r1.errors).toEqual([]);

    const tasks = await db.query(`select title from tasks where company_id = $1 and source = 'automatizacion' order by title`, [companyId]);
    expect(tasks.rows.map((t) => t.title)).toEqual(["Llamar a Lead Olvidado (600000002)", "Seguimiento del presupuesto P-T-0001"]);
  });

  it("no duplica en ejecuciones posteriores", async () => {
    const r2 = await runAutomations({ companyId });
    expect(Object.values(r2.actions).every((n) => n === 0)).toBe(true);
    const tasks = await db.query(`select count(*)::int as n from tasks where company_id = $1 and source = 'automatizacion'`, [companyId]);
    expect(tasks.rows[0].n).toBe(2);
  });

  it("sin proveedor de email no marca nada como enviado", async () => {
    const out = await db.query(`select status, last_error from email_outbox where company_id = $1`, [companyId]);
    expect(out.rows.length).toBeGreaterThan(0);
    for (const row of out.rows) {
      expect(row.status).toBe("no_configurado");
      expect(row.last_error).toMatch(/Correo de envío/);
    }
  });

  it("respeta automatizaciones desactivadas", async () => {
    await db.query(`update automations set enabled = false where company_id = $1`, [companyId]);
    await db.query(`insert into contacts(company_id,name,phone,stage,created_at) values ($1,'Otro Lead','600000003','nuevo', now() - interval '9 hours')`, [companyId]);
    const r = await runAutomations({ companyId });
    expect(r.actions.tarea_contacto_nuevo).toBe(0);
  });
});
