import { expect, test } from "@playwright/test";
import { db, login, DEMO_PASSWORD } from "./helpers";
import { hashPassword } from "../src/lib/auth/password";

const OWNER = "propietario@demo.example";
const SALES = "comercial@demo.example";
const stamp = Date.now().toString().slice(-6);

test.beforeAll(async () => {
  const pool = db();
  await pool.query(`delete from rate_limits`);
  await pool.end();
});

test("sin sesión no se accede a la aplicación ni a la API", async ({ page, request }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/export/contactos.csv")).status()).toBe(401);
});

test("credenciales incorrectas muestran un error claro", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", OWNER);
  await page.fill("#password", "incorrecta-123");
  await page.click("button[type=submit]");
  await expect(page.getByText("El email o la contraseña no son correctos.")).toBeVisible();
});

test("flujo comercial completo: contacto → fase → presupuesto revisado y enviado → PDF", async ({ page }) => {
  await login(page, OWNER);
  // Nuevo contacto
  await page.goto("/contactos/nuevo");
  const name = `Cliente E2E ${stamp}`;
  await page.fill("#name", name);
  await page.fill("#phone", `611 ${stamp.slice(0, 3)} ${stamp.slice(3)}`);
  await page.fill("#postal_code", "46701");
  await page.fill("#estimated_amount", "4.500");
  await page.click("button:has-text('Crear contacto')");
  await expect(page.getByRole("status").filter({ hasText: "Contacto creado." })).toBeVisible();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const contactUrl = page.url();

  // Nota y cambio de fase
  await page.fill("#note-body", "Llamada: quiere dos splits.");
  await page.click("button:has-text('Añadir al historial')");
  await expect(page.getByRole("status").filter({ hasText: "Anotado en el historial." })).toBeVisible();
  await page.getByLabel("Pendiente de contactar").check();
  await page.click("button:has-text('Mover a «Pendiente»')");
  await expect(page.getByRole("status").filter({ hasText: "Movido a «Pendiente de contactar»." })).toBeVisible();

  // Presupuesto
  await page.click("a:has-text('Nuevo presupuesto')");
  await page.locator("textarea[id^=d-]").first().fill("Equipo split 3,5 kW");
  await page.fill("input[aria-label='Cantidad línea 1']", "2");
  await page.fill("input[aria-label='Precio unitario línea 1']", "890");
  await page.click("button:has-text('Añadir línea')");
  await page.locator("textarea[id^=d-]").nth(1).fill("Instalación");
  await page.fill("input[aria-label='Precio unitario línea 2']", "340,50");
  await expect(page.getByText("2.565,81 €")).toBeVisible(); // 2.120,50 + 21 %
  await page.click("button:has-text('Guardar borrador')");
  await expect(page.getByRole("status").filter({ hasText: "Borrador de presupuesto creado" })).toBeVisible();

  // No se puede enviar sin revisar: solo aparece «Dar por revisado»
  await expect(page.getByRole("button", { name: "Marcar como enviado" })).toHaveCount(0);
  await page.click("button:has-text('Dar por revisado')");
  await expect(page.getByRole("status").filter({ hasText: "Estado actualizado: Revisado." })).toBeVisible();
  await page.click("button:has-text('Marcar como enviado')");
  await expect(page.getByRole("status").filter({ hasText: "Estado actualizado: Enviado." })).toBeVisible();

  const pdf = await page.request.get(page.url().split("?")[0].replace("/presupuestos/", "/api/quotes/") + "/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // La oportunidad avanza sola a «Presupuesto enviado»
  await page.goto(contactUrl);
  await expect(page.getByText("Presupuesto enviado").first()).toBeVisible();
});

test("el formulario público crea el contacto con folio y consentimiento", async ({ page }) => {
  await page.goto("/f/demo");
  await page.waitForTimeout(3200); // tiempo mínimo antispam
  const name = `Solicitud Web ${stamp}`;
  await page.fill("#name", name);
  await page.fill("#email", `web${stamp}@cliente.example`);
  await page.fill("#location", "Gandia");
  await page.check("input[name=consent]");
  await page.click("button:has-text('Enviar solicitud')");
  await expect(page.getByText("Solicitud recibida")).toBeVisible();
  const pool = db();
  const r = await pool.query(`select source, stage, consent_at from contacts where name = $1`, [name]);
  await pool.end();
  expect(r.rows[0]).toMatchObject({ source: "formulario_web", stage: "nuevo" });
  expect(r.rows[0].consent_at).not.toBeNull();
});

test("un comercial no puede revisar presupuestos ni gestionar usuarios", async ({ page }) => {
  await login(page, SALES);
  await page.goto("/ajustes/usuarios");
  await expect(page.getByText("Añadir usuario")).toHaveCount(0);
  await page.goto("/presupuestos?estado=borrador");
  const first = page.locator("table a[href^='/presupuestos/']").first();
  if (await first.count()) {
    await first.click();
    await expect(page.getByRole("button", { name: "Dar por revisado" })).toBeDisabled();
  }
  expect((await page.request.get("/api/export/contactos.csv")).status()).toBe(403);
});

test.describe("aislamiento entre empresas", () => {
  const otherEmail = `aislada-${stamp}@example.test`;
  test.beforeAll(async () => {
    const pool = db();
    const c = await pool.query(`insert into companies(slug, name) values ($1, 'Empresa Aislada') returning id`, [`aislada-${stamp}`]);
    await pool.query(`insert into users(company_id, email, name, password_hash, role) values ($1,$2,'Otra Empresa',$3,'propietario')`, [c.rows[0].id, otherEmail, await hashPassword(DEMO_PASSWORD)]);
    await pool.end();
  });
  test.afterAll(async () => {
    const pool = db();
    await pool.query(`delete from companies where slug = $1`, [`aislada-${stamp}`]);
    await pool.end();
  });

  test("otra empresa no ve ni descarga datos de la demo", async ({ page }) => {
    const pool = db();
    const demo = await pool.query(`select c.id as contact, q.id as quote from contacts c join companies co on co.id = c.company_id and co.slug = 'demo' left join quotes q on q.contact_id = c.id where q.id is not null limit 1`);
    await pool.end();
    await login(page, otherEmail);
    await page.goto("/contactos");
    await expect(page.getByText("Todavía no hay contactos")).toBeVisible();
    const resp = await page.goto(`/contactos/${demo.rows[0].contact}`);
    expect(resp?.status()).toBe(404);
    expect((await page.request.get(`/api/quotes/${demo.rows[0].quote}/pdf`)).status()).toBe(404);
    const csv = await (await page.request.get("/api/export/contactos.csv")).text();
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1); // solo cabecera
  });
});
