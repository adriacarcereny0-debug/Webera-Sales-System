import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { db } from "./helpers";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Página pública de Webora Studio → solicitud de demostración → aviso por correo → alta con un clic desde /admin.
 * La parte de correo se ejecuta solo con E2E_SMTP_SINK (servidor SMTP de pruebas en 127.0.0.1:587).
 */
const SINK = process.env.E2E_SMTP_SINK;
const stamp = Date.now().toString().slice(-6);
const ADMIN = { email: `admin-landing-${stamp}@example.test`, password: `Adm1n-${randomBytes(6).toString("hex")}` };
const LEAD = { name: "Laura Pruebas", company: `Climatiza Landing ${stamp}`, email: `laura-${stamp}@example.test` };
const received = () => (SINK && existsSync(SINK) ? readFileSync(SINK, "utf8").replace(/=\r?\n/g, "") : "");

test.beforeAll(async () => {
  const pool = db();
  await pool.query(`delete from rate_limits`);
  await pool.query(`insert into platform_admins(email, name, password_hash) values ($1, 'Admin Landing', $2)`, [ADMIN.email, await hashPassword(ADMIN.password)]);
  await pool.end();
});
test.afterAll(async () => {
  const pool = db();
  await pool.query(`delete from companies where slug like 'climatiza-landing-%'`);
  await pool.query(`delete from platform_leads where email = $1`, [LEAD.email]);
  await pool.query(`update platform_settings set provider = null, from_email = null, smtp_host = null, smtp_port = null, smtp_user = null, secret_enc = null,
    secret_hint = null, tested_at = null, test_ok = null, test_error = null, notify_emails = '{}' where id`);
  await pool.query(`delete from platform_audit where admin_id = (select id from platform_admins where email = $1)`, [ADMIN.email]);
  await pool.query(`delete from platform_admins where email = $1`, [ADMIN.email]);
  await pool.end();
});

test("la portada es pública y lleva al formulario de demostración", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /demostración/i }).first().click();
  await expect(page.locator("#d-name")).toBeInViewport();
  // Sin scroll horizontal en móvil
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("solicitud de demostración → aviso → alta con un clic", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/admin$/);

  if (SINK) {
    await page.goto("/admin/correo");
    await page.getByText("Correo de tu dominio").click();
    await page.fill("#from_email", `hola${stamp}@webera.test`);
    await page.fill("#smtp_host", "127.0.0.1");
    await page.selectOption("#smtp_port", "587");
    await page.fill("#smtp_user", "buzon");
    await page.fill("#secret", "buzon-secreto-123");
    await page.click("button:has-text('Guardar y enviar correo de prueba')");
    await expect(page.getByRole("status").filter({ hasText: "Conectado" })).toBeVisible();
    await page.fill("#notify_emails", `ventas${stamp}@webera.test`);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Guardado." })).toBeVisible();
  }

  // El interesado rellena el formulario desde un anuncio
  const visitor = await page.context().browser()!.newPage();
  await visitor.goto("/?utm_source=e2e-anuncio#demo");
  await visitor.fill("#d-name", LEAD.name);
  await visitor.fill("#d-company", LEAD.company);
  await visitor.fill("#d-email", LEAD.email);
  await visitor.fill("#d-phone", "611 222 333");
  await visitor.fill("#d-city", "Castellón");
  await visitor.selectOption("#d-team", "2-5");
  await visitor.locator("input[name=consent]").check();
  await visitor.waitForTimeout(3200); // el formulario rechaza envíos de robots en menos de 3 s
  await visitor.getByRole("button", { name: "Pedir una demostración" }).click();
  await expect(visitor.getByText("¡Recibido!")).toBeVisible();
  await visitor.close();

  if (SINK) {
    await expect.poll(received).toContain(`TO ventas${stamp}@webera.test`);
    expect(received()).toContain(`TO ${LEAD.email}`);
  }

  // Aparece en Solicitudes con el origen y el contador
  await page.goto("/admin/solicitudes");
  const card = page.locator("article", { hasText: LEAD.company });
  await expect(card).toBeVisible();
  await expect(card.getByText("vía e2e-anuncio")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Consola" }).getByLabel(/nuevas/)).toBeVisible();

  // Nota interna
  await card.locator("textarea[name=notes]").fill("Llamar el lunes");
  await card.getByRole("button", { name: "Guardar nota" }).click();
  await expect(card.locator("textarea[name=notes]")).toHaveValue("Llamar el lunes");

  // Alta con los datos copiados
  await card.getByRole("link", { name: "Dar de alta" }).click();
  await expect(page.locator("#name")).toHaveValue(LEAD.company);
  await expect(page.locator("#owner_email")).toHaveValue(LEAD.email);
  await expect(page.locator("#owner_name")).toHaveValue(LEAD.name);
  await page.click("button:has-text('Crear empresa y acceso')");
  await expect(page.getByText("Credenciales para entregar al cliente")).toBeVisible();

  await page.goto("/admin/solicitudes?estado=alta");
  await expect(page.locator("article", { hasText: LEAD.company }).getByText("Dada de alta")).toBeVisible();
});
