import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { db } from "./helpers";
import { hashPassword } from "../src/lib/auth/password";

const stamp = Date.now().toString().slice(-6);
const ADMIN = { email: `admin-e2e-${stamp}@example.test`, password: `Adm1n-${randomBytes(6).toString("hex")}` };
const CLIENT = { company: `Instalaciones Prueba ${stamp}`, slug: `prueba-${stamp}`, email: `cliente-${stamp}@example.test` };

test.beforeAll(async () => {
  const pool = db();
  await pool.query(`delete from rate_limits`);
  await pool.query(`insert into platform_admins(email, name, password_hash) values ($1, 'Admin E2E', $2)`, [ADMIN.email, await hashPassword(ADMIN.password)]);
  await pool.end();
});
test.afterAll(async () => {
  const pool = db();
  await pool.query(`delete from companies where slug = $1`, [CLIENT.slug]);
  await pool.query(`delete from platform_audit where admin_id = (select id from platform_admins where email = $1)`, [ADMIN.email]);
  await pool.query(`delete from platform_admins where email = $1`, [ADMIN.email]);
  await pool.end();
});

test("la consola exige su propio acceso", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  // Un usuario de empresa no entra en la consola
  await page.fill("#email", "propietario@demo.example");
  await page.fill("#password", process.env.DEMO_PASSWORD ?? "demo-webera-2026");
  await page.click("button[type=submit]");
  await expect(page.getByText("Credenciales no válidas.")).toBeVisible();
});

test("alta de cliente, contraseñas, primer acceso, suspensión y baja", async ({ page, browser }) => {
  await page.goto("/admin/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/admin$/);

  // Alta con contraseña generada
  await page.goto("/admin/empresas/nueva");
  await page.fill("#name", CLIENT.company);
  await page.fill("#slug", CLIENT.slug);
  await page.fill("#owner_name", "Cliente Prueba");
  await page.fill("#owner_email", CLIENT.email);
  await page.click("button:has-text('Crear empresa y acceso')");
  await expect(page.getByText("Credenciales para entregar al cliente")).toBeVisible();
  await expect(page.getByText(CLIENT.email)).toBeVisible();

  // Contraseña escrita a mano, sin obligar a cambiarla
  await page.click("text=Ver la empresa");
  await page.click("text=Cambiar contraseña…");
  const pwForm = page.locator("form", { has: page.getByRole("button", { name: "Establecer contraseña" }) });
  await pwForm.getByText("Escribirla yo").click();
  const manual = `Cliente-${stamp}-ok`;
  await pwForm.locator("input[name=password]").fill(manual);
  await pwForm.getByLabel("Pedir que la cambie en el primer acceso").uncheck();
  await pwForm.getByRole("button", { name: "Establecer contraseña" }).click();
  await expect(page.getByText(manual)).toBeVisible();

  // El cliente entra con esa contraseña
  const client = await (await browser.newContext()).newPage();
  await client.goto("/login");
  await client.fill("#email", CLIENT.email);
  await client.fill("#password", manual);
  await client.click("button[type=submit]");
  await expect(client).toHaveURL(/\/panel/);
  await expect(client.getByText(CLIENT.company).first()).toBeVisible();

  // Suspender: su sesión deja de valer y no puede volver a entrar
  await page.getByLabel("Cuenta activa").uncheck();
  await page.click("button:has-text('Guardar empresa')");
  await expect(page.getByText("sus usuarios ya no pueden entrar")).toBeVisible();
  await client.goto("/panel");
  await expect(client).toHaveURL(/\/login/);
  await client.fill("#email", CLIENT.email);
  await client.fill("#password", manual);
  await client.click("button[type=submit]");
  await expect(client.getByText("está suspendida")).toBeVisible();

  // Eliminar exige escribir el identificador
  await page.click("button:has-text('Eliminar empresa')");
  await page.fill("#confirm", CLIENT.slug);
  await page.click("button:has-text('Eliminar para siempre')");
  await expect(page).toHaveURL(/\/admin\/empresas\?aviso=eliminada/);
  const pool = db();
  const left = await pool.query(`select count(*)::int as n from companies where slug = $1`, [CLIENT.slug]);
  const audit = await pool.query(`select action from platform_audit where target in ($1, $2) order by created_at`, [CLIENT.slug, CLIENT.email]);
  await pool.end();
  expect(left.rows[0].n).toBe(0);
  expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(["empresa.crear", "usuario.contrasena", "empresa.eliminar"]));
});
