import { expect, test } from "@playwright/test";
import { db, login } from "./helpers";

const stamp = Date.now().toString().slice(-6);

test("presupuesto online: el instalador lo envía y el cliente lo acepta desde el enlace", async ({ page, browser }) => {
  const pool = db();
  const c = (await pool.query(
    `insert into contacts(company_id, name, phone, stage, is_demo) select id, $1, '699000111', 'visita_programada', true from companies where slug = 'demo' returning id, company_id`,
    [`Cliente Online ${stamp}`])).rows[0];
  const q = (await pool.query(
    `insert into quotes(company_id, contact_id, number, code, status, valid_until, subtotal_cents, tax_cents, total_cents, reviewed_at, is_demo)
     values ($1,$2,9000 + floor(random()*900)::int,$3,'revisado', current_date + 30, 200000, 42000, 242000, now(), true) returning id`,
    [c.company_id, c.id, `P-E2E-${stamp}`])).rows[0];
  await pool.query(
    `insert into quote_items(company_id, quote_id, position, description, quantity, unit, unit_price_cents, discount_pct, tax_rate, line_net_cents)
     values ($1,$2,0,'Equipo de aerotermia',1,'ud',200000,0,21,200000)`, [c.company_id, q.id]);

  await login(page, "propietario@demo.example");
  await page.goto(`/presupuestos/${q.id}`);
  await page.fill("#send-to", `online${stamp}@cliente.example`);
  await page.click("button:has-text('Enviar por email')");
  await expect(page.getByRole("status").filter({ hasText: `online${stamp}@cliente.example` })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copiar enlace del cliente/ })).toBeVisible();
  const token = (await pool.query(`select public_token, status from quotes where id = $1`, [q.id])).rows[0];
  expect(token.status).toBe("enviado");

  // El cliente abre el enlace sin estar registrado.
  const client = await browser.newContext();
  const cp = await client.newPage();
  await cp.goto(`/p/${token.public_token}`);
  await expect(cp.getByText("Equipo de aerotermia").first()).toBeVisible();
  await expect(cp.getByText(/2\.420,00/).first()).toBeVisible();
  const pdf = await cp.request.get(`/api/public/quote/${token.public_token}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await cp.click("button:has-text('Aceptar presupuesto')");
  await expect(cp.getByText("Lo aceptaste el")).toBeVisible();
  await cp.reload();
  await expect(cp.getByText("Lo aceptaste el")).toBeVisible();
  await expect(cp.getByRole("button", { name: /Aceptar presupuesto/ })).toHaveCount(0);
  await client.close();

  const after = (await pool.query(`select q.status, c.stage from quotes q join contacts c on c.id = q.contact_id where q.id = $1`, [q.id])).rows[0];
  expect(after).toEqual({ status: "aceptado", stage: "ganado" });
  const task = (await pool.query(`select title from tasks where quote_id = $1`, [q.id])).rows;
  expect(task[0].title).toContain("Planificar la instalación");

  // Un enlace inventado no enseña nada.
  const bad = await page.goto(`/p/${"A".repeat(32)}`);
  expect(bad?.status()).toBe(404);
  await pool.query(`delete from quotes where id = $1`, [q.id]);
  await pool.query(`delete from contacts where id = $1`, [c.id]);
  await pool.end();
});

test("si el mismo cliente vuelve a escribir, se junta en su ficha y se le contesta", async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.goto("/f/demo");
    await page.waitForTimeout(3200);
    await page.fill("#name", `Repetido ${stamp}`);
    await page.fill("#email", `repetido${stamp}@cliente.example`);
    await page.fill("#location", "Gandia");
    if (i === 1) await page.fill("#description", "Vuelvo a escribir: también me interesan placas solares");
    await page.check("input[name=consent]");
    await page.click("button:has-text('Enviar solicitud')");
    await expect(page.getByText("Solicitud recibida")).toBeVisible();
  }
  const pool = db();
  const rows = (await pool.query(`select id, owner_id, description from contacts where email = $1`, [`repetido${stamp}@cliente.example`])).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].owner_id).not.toBeNull();
  expect(rows[0].description).toContain("placas solares");
  const replies = (await pool.query(`select count(*)::int as n from email_outbox where to_email = $1 and automation_key = 'respuesta_cliente'`, [`repetido${stamp}@cliente.example`])).rows[0].n;
  expect(replies).toBe(2);
  await pool.query(`delete from contacts where id = $1`, [rows[0].id]);
  await pool.end();
});

test("la pantalla de automatizaciones explica todo por bloques y vienen activadas", async ({ page }) => {
  await login(page, "propietario@demo.example");
  await page.goto("/automatizaciones");
  for (const h of ["Cuando llega una solicitud", "Mientras se trabaja la venta", "Recordatorios y avisos"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Contestar al cliente que ha escrito" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Activar «Repartir las solicitudes por turnos»" })).toBeChecked();
});
