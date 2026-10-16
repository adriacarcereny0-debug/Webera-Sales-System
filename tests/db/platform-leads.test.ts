/**
 * Solicitudes de demostración (página pública de Webera) contra PostgreSQL real.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("solicitudes de demostración", () => {
  let db: Pool;
  let L: typeof import("@/server/platform-leads");
  const lead = { name: "Marta Instaladora", company: "Clima Leads Test", email: "marta@leads.test", phone: "600 000 000", city: "Valencia", teamSize: "2-5" as const, message: "Quiero verlo", source: "google" };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.EMAIL_PROVIDER;
    db = new Pool({ connectionString: url });
    await db.query(`delete from platform_leads where email like '%@leads.test'`);
    await db.query(`update platform_settings set provider = null, from_email = null, secret_enc = null where id`);
    L = await import("@/server/platform-leads");
  });

  afterAll(async () => {
    await db.query(`delete from platform_leads where email like '%@leads.test'`);
    await db.query(`update platform_settings set provider = null, from_email = null, smtp_host = null, smtp_port = null, smtp_user = null, secret_enc = null, secret_hint = null where id`);
    await db.end();
    const { pool } = await import("@/lib/db");
    await pool().end();
  });

  it("guarda la solicitud aunque no haya correo de Webera", async () => {
    const r = await L.createPlatformLead(lead);
    expect(r.emailed).toBe(false);
    const row = (await db.query(`select * from platform_leads where id = $1`, [r.id])).rows[0];
    expect(row).toMatchObject({ name: lead.name, company: lead.company, status: "nueva", team_size: "2-5", source: "google" });
    expect(row.consent_at).toBeTruthy();
  });

  it("si el correo falla, la solicitud queda guardada igualmente", async () => {
    const { encryptSecret } = await import("@/lib/crypto");
    await db.query(`update platform_settings set provider = 'smtp', from_email = 'webera@leads.test', smtp_host = '127.0.0.1', smtp_port = 1, smtp_secure = false,
      smtp_user = 'webera@leads.test', secret_enc = $1 where id`, [encryptSecret("x")]);
    const r = await L.createPlatformLead({ ...lead, email: "otro@leads.test" });
    expect(r.emailed).toBe(true);
    expect((await db.query(`select count(*)::int as n from platform_leads where id = $1`, [r.id])).rows[0].n).toBe(1);
  });

  it("la app con rol restringido no puede leer las solicitudes", async () => {
    const c = await db.connect();
    try {
      await c.query("begin");
      await c.query("set local role webera_app");
      await expect(c.query("select * from platform_leads")).rejects.toThrow(/permission denied/);
    } finally {
      await c.query("rollback");
      c.release();
    }
  });
});
