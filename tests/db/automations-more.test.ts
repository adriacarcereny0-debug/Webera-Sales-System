/**
 * Automatizaciones nuevas contra PostgreSQL real: entrada de solicitudes, fases,
 * tareas, presupuestos caducados, correos al cliente y presupuesto online.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("automatizaciones nuevas", () => {
  let db: Pool;
  let companyId: string;
  let owner: string;
  let sales: string;
  let A: typeof import("@/server/automations");
  let Q: typeof import("@/server/quote-online");
  let withTenant: typeof import("@/lib/db").withTenant;
  const T = <R,>(fn: Parameters<typeof withTenant<R>>[1]) => withTenant({ companyId, userId: null }, fn);
  const outbox = async (key?: string) =>
    (await db.query(`select to_email, subject, body_text, automation_key from email_outbox where company_id = $1 ${key ? "and automation_key = $2" : ""} order by created_at`, key ? [companyId, key] : [companyId])).rows;
  const stage = async (id: string) => (await db.query(`select stage from contacts where id = $1`, [id])).rows[0].stage;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.EMAIL_PROVIDER;
    db = new Pool({ connectionString: url });
    await db.query(`delete from companies where slug = 'auto-more'`);
    companyId = (await db.query(`insert into companies(slug, name, phone, email) values ('auto-more','Clima Pruebas','961000000','oficina@clima.test') returning id`)).rows[0].id;
    const { applyCompanyDefaults } = await import("@/lib/company-defaults");
    await applyCompanyDefaults({ query: async (t, p) => (await db.query(t, p as unknown[])).rows }, companyId);
    owner = (await db.query(`insert into users(company_id,email,name,password_hash,role) values ($1,'dueña@clima.test','Ana Dueña','x','propietario') returning id`, [companyId])).rows[0].id;
    sales = (await db.query(`insert into users(company_id,email,name,password_hash,role) values ($1,'comercial@clima.test','Bea Comercial','x','comercial') returning id`, [companyId])).rows[0].id;
    A = await import("@/server/automations");
    Q = await import("@/server/quote-online");
    ({ withTenant } = await import("@/lib/db"));
  });

  afterAll(async () => {
    await db.query(`delete from companies where slug = 'auto-more'`);
    await db.end();
    const { pool } = await import("@/lib/db");
    await pool().end();
  });

  async function newLead(name: string, email: string | null, phone: string | null) {
    return (await db.query(`insert into contacts(company_id,name,email,phone,source,stage,consent_at) values ($1,$2,$3,$4,'formulario_web','nuevo',now()) returning id`, [companyId, name, email, phone])).rows[0].id as string;
  }

  it("las automatizaciones nuevas vienen activadas (salvo el recordatorio al cliente)", async () => {
    const r = await db.query(`select key, enabled from automations where company_id = $1`, [companyId]);
    const on = Object.fromEntries(r.rows.map((x) => [x.key, x.enabled]));
    expect(on.respuesta_cliente).toBe(true);
    expect(on.asignacion_automatica).toBe(true);
    expect(on.resumen_diario).toBe(true);
    expect(on.seguimiento_cliente).toBe(false);
  });

  it("al llegar una solicitud: se reparte por turnos, se avisa al equipo y se contesta al cliente", async () => {
    const l1 = await newLead("Carla Ruiz", "carla@cliente.test", "600111222");
    await T((tx) => A.onNewLead(tx, l1));
    const l2 = await newLead("David Gil", "david@cliente.test", "600333444");
    await T((tx) => A.onNewLead(tx, l2));
    const owners = (await db.query(`select name, owner_id, next_action from contacts where id in ($1,$2) order by name`, [l1, l2])).rows;
    expect(new Set(owners.map((o) => o.owner_id))).toEqual(new Set([owner, sales]));
    expect(owners[0].next_action).toBe("Llamar a Carla Ruiz");
    const replies = await outbox("respuesta_cliente");
    expect(replies.map((m) => m.to_email)).toEqual(["carla@cliente.test", "david@cliente.test"]);
    expect(replies[0].subject).toContain("Hemos recibido tu solicitud");
    expect(replies[0].body_text).toContain("Hola, Carla");
    expect(replies[0].body_text).toContain("961000000");
    const team = await outbox("aviso_nueva_solicitud");
    expect(team.length).toBeGreaterThanOrEqual(2);
  });

  it("detecta a un cliente que vuelve a escribir (mismo teléfono con otro formato)", async () => {
    const dup = await T((tx) => A.findOpenDuplicate(tx, null, "+34 600 111 222"));
    expect(dup).not.toBeNull();
    const none = await T((tx) => A.findOpenDuplicate(tx, "otro@cliente.test", null));
    expect(none).toBeNull();
  });

  it("programar una visita mueve la ficha y al hacerla se crea «Preparar presupuesto»", async () => {
    const c = await newLead("Elena Mora", null, "600555666");
    await T((tx) => A.onVisitScheduled(tx, c, null));
    expect(await stage(c)).toBe("visita_programada");
    const task = (await db.query(`insert into tasks(company_id, kind, title, due_at, contact_id, assigned_to, done_at) values ($1,'visita','Visita',now(),$2,$3,now()) returning id`, [companyId, c, sales])).rows[0].id;
    await T((tx) => A.onTaskDone(tx, task));
    await T((tx) => A.onTaskDone(tx, task)); // no se duplica
    const t = (await db.query(`select title, assigned_to from tasks where contact_id = $1 and source = 'automatizacion'`, [c])).rows;
    expect(t).toEqual([{ title: "Preparar presupuesto para Elena Mora", assigned_to: sales }]);
  });

  it("si el cliente rechaza el único presupuesto, la ficha pasa a «Perdido» con el motivo", async () => {
    const c = await newLead("Fran Sanz", null, "600777888");
    const q = (await db.query(`insert into quotes(company_id, contact_id, number, code, status, valid_until) values ($1,$2,90,'P-T-0090','rechazado', current_date + 10) returning id`, [companyId, c])).rows[0].id;
    await T((tx) => A.onQuoteStatus(tx, q, "rechazado", null));
    const r = (await db.query(`select stage, lost_reason from contacts where id = $1`, [c])).rows[0];
    expect(r).toEqual({ stage: "perdido", lost_reason: "Rechazó el presupuesto P-T-0090" });
  });

  it("con «Mover la ficha de fase sola» apagada no se toca la fase", async () => {
    await db.query(`update automations set enabled = false where company_id = $1 and key = 'fase_automatica'`, [companyId]);
    const c = await newLead("Gema Pons", null, null);
    await T((tx) => A.onVisitScheduled(tx, c, null));
    expect(await stage(c)).toBe("nuevo");
    await db.query(`update automations set enabled = true where company_id = $1 and key = 'fase_automatica'`, [companyId]);
  });

  it("caduca los presupuestos vencidos, avisa al cliente de su visita y le recuerda el presupuesto", async () => {
    const c = await newLead("Hugo Vera", "hugo@cliente.test", "600999000");
    await db.query(`update contacts set owner_id = $2 where id = $1`, [c, sales]);
    const old = (await db.query(
      `insert into quotes(company_id, contact_id, number, code, status, issue_date, valid_until, sent_at, total_cents) values ($1,$2,91,'P-T-0091','enviado', current_date - 40, current_date - 1, now() - interval '40 days', 50000) returning id`, [companyId, c])).rows[0].id;
    const live = (await db.query(
      `insert into quotes(company_id, contact_id, number, code, status, issue_date, valid_until, sent_at, total_cents) values ($1,$2,92,'P-T-0092','enviado', current_date - 6, current_date + 20, now() - interval '6 days', 121000) returning id`, [companyId, c])).rows[0].id;
    await db.query(`insert into tasks(company_id, kind, title, due_at, location, contact_id, assigned_to) values ($1,'visita','Visita técnica', now() + interval '20 hours', 'C/ Mayor 1, Gandia', $2, $3)`, [companyId, c, sales]);
    await db.query(`update automations set enabled = true where company_id = $1 and key = 'seguimiento_cliente'`, [companyId]);

    const r = await A.runAutomations({ companyId });
    expect(r.errors).toEqual([]);
    expect(r.actions.caducar_presupuestos).toBe(1);
    expect(r.actions.recordatorio_visita_cliente).toBe(1);
    expect(r.actions.seguimiento_cliente).toBe(1);
    expect((await db.query(`select status from quotes where id = $1`, [old])).rows[0].status).toBe("caducado");
    const tasks = (await db.query(`select title from tasks where quote_id = $1`, [old])).rows.map((t) => t.title);
    expect(tasks).toContain("Llamar a Hugo Vera: el presupuesto P-T-0091 ha caducado");

    const visit = await outbox("recordatorio_visita_cliente");
    expect(visit.map((m) => m.to_email)).toEqual(["hugo@cliente.test"]);
    expect(visit[0].body_text).toContain("C/ Mayor 1, Gandia");
    expect(visit[0].body_text).toContain("Bea Comercial");
    const follow = await outbox("seguimiento_cliente");
    expect(follow).toHaveLength(1);
    const token = (await db.query(`select public_token from quotes where id = $1`, [live])).rows[0].public_token;
    expect(follow[0].body_text).toContain(`/p/${token}`);

    // Segunda ejecución: nada se repite.
    const r2 = await A.runAutomations({ companyId });
    expect(r2.actions.caducar_presupuestos + r2.actions.recordatorio_visita_cliente + r2.actions.seguimiento_cliente).toBe(0);
  });

  it("presupuesto online: se envía por email, el cliente lo acepta y todo se actualiza solo", async () => {
    const c = await newLead("Irene Puig", null, "611222333");
    await db.query(`update contacts set owner_id = $2, stage = 'visita_programada' where id = $1`, [c, sales]);
    const q = (await db.query(
      `insert into quotes(company_id, contact_id, number, code, status, valid_until, subtotal_cents, tax_cents, total_cents, created_by) values ($1,$2,93,'P-T-0093','revisado', current_date + 30, 100000, 21000, 121000, $3) returning id`,
      [companyId, c, owner])).rows[0].id;

    const bad = await T((tx) => Q.sendQuoteByEmail(tx, q, owner, "no-es-un-email"));
    expect(bad).toEqual({ error: "Escribe el email del cliente." });
    const sent = await T((tx) => Q.sendQuoteByEmail(tx, q, owner, "irene@cliente.test"));
    expect(sent).toEqual({ to: "irene@cliente.test", code: "P-T-0093" });
    const row = (await db.query(`select status, public_token, emailed_to from quotes where id = $1`, [q])).rows[0];
    expect(row.status).toBe("enviado");
    expect(row.public_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await stage(c)).toBe("presupuesto_enviado");
    expect((await db.query(`select email from contacts where id = $1`, [c])).rows[0].email).toBe("irene@cliente.test");
    const mail = (await db.query(`select body_text from email_outbox where related_id = $1 and to_email = 'irene@cliente.test'`, [q])).rows[0];
    expect(mail.body_text).toContain(`/p/${row.public_token}`);
    expect(mail.body_text).toMatch(/1\.210,00\s€/);

    expect(await Q.getPublicQuote("x".repeat(32))).toBeNull();
    const view = await Q.getPublicQuote(row.public_token);
    expect(view?.quote.code).toBe("P-T-0093");
    expect((await db.query(`select client_viewed_at from quotes where id = $1`, [q])).rows[0].client_viewed_at).not.toBeNull();

    const ok = await Q.decidePublicQuote(row.public_token, "aceptado", "Perfecto, adelante");
    expect(ok).toEqual({ ok: true });
    const again = await Q.decidePublicQuote(row.public_token, "rechazado", null);
    expect(again).toEqual({ error: "Este presupuesto ya tiene respuesta." });
    expect((await db.query(`select status, client_note from quotes where id = $1`, [q])).rows[0]).toEqual({ status: "aceptado", client_note: "Perfecto, adelante" });
    expect(await stage(c)).toBe("ganado");
    const plan = (await db.query(`select title, assigned_to from tasks where quote_id = $1`, [q])).rows;
    expect(plan).toEqual([{ title: "Planificar la instalación con Irene Puig (P-T-0093 aceptado)", assigned_to: sales }]);
    const notice = (await db.query(`select to_email, subject from email_outbox where related_id = $1 and subject like '%aceptado%'`, [q])).rows;
    expect(notice).toEqual([{ to_email: "comercial@clima.test", subject: "✓ Irene Puig ha aceptado el presupuesto P-T-0093" }]);
  });

  it("no se puede enviar un borrador", async () => {
    const c = await newLead("Jon Mas", "jon@cliente.test", null);
    const q = (await db.query(`insert into quotes(company_id, contact_id, number, code, status, valid_until) values ($1,$2,94,'P-T-0094','borrador', current_date + 30) returning id`, [companyId, c])).rows[0].id;
    expect(await T((tx) => Q.sendQuoteByEmail(tx, q, owner, null))).toEqual({ error: "Antes de enviarlo, el presupuesto debe quedar revisado." });
  });
});
