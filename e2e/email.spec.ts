import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { db, login } from "./helpers";

/**
 * Correo propio de cada empresa contra un servidor SMTP de pruebas local (puerto 587, con usuario y contraseña).
 * Se ejecuta solo con E2E_SMTP_SINK=<fichero donde el servidor de pruebas escribe lo que recibe>.
 */
const SINK = process.env.E2E_SMTP_SINK;
test.skip(!SINK, "Sin servidor SMTP de pruebas (E2E_SMTP_SINK)");

const stamp = Date.now().toString().slice(-6);
/** Lo recibido, con el «quoted-printable» de cabeceras y cuerpo decodificado para poder buscar texto. */
const received = () => {
  if (!existsSync(SINK!)) return "";
  const raw = readFileSync(SINK!, "utf8").replace(/\?=\s+=\?UTF-8\?Q\?/g, "").replace(/=\?UTF-8\?Q\?|\?=/g, "").replace(/=\r?\n/g, "");
  return Buffer.from(raw.replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8").replace(/_/g, " ");
};

test.afterAll(async () => {
  const pool = db();
  await pool.query(`delete from company_email_settings where company_id = (select id from companies where slug = 'demo')`);
  await pool.end();
});

test("cada empresa conecta su propio correo, la contraseña no se muestra y los avisos salen por él", async ({ page }) => {
  await login(page, "propietario@demo.example");
  await page.goto("/ajustes/correo");
  await expect(page.getByText("Todavía no has conectado ningún correo")).toBeVisible();

  // Contraseña equivocada: se guarda, pero la prueba falla con un mensaje comprensible.
  await page.getByText("Correo de tu dominio").click();
  await page.fill("#from_email", `avisos${stamp}@demo.example`);
  await page.fill("#smtp_host", "127.0.0.1");
  await page.selectOption("#smtp_port", "587");
  await page.fill("#smtp_user", "buzon");
  await page.fill("#secret", "contraseña-mala");
  await page.click("button:has-text('Guardar y enviar correo de prueba')");
  await expect(page.getByRole("alert").filter({ hasText: "el correo de prueba no ha salido" })).toBeVisible();
  await expect(page.getByText("la última prueba falló")).toBeVisible();

  // Contraseña buena.
  await page.fill("#secret", "buzon-secreto-123");
  await page.click("button:has-text('Guardar y enviar correo de prueba')");
  await expect(page.getByRole("status").filter({ hasText: "Conectado. Te hemos enviado un correo de prueba" })).toBeVisible();
  await expect.poll(received).toContain("Prueba de correo");
  expect(received()).toContain(`FROM avisos${stamp}@demo.example`);
  expect(received()).toContain("AUTH buzon");

  // La contraseña está cifrada en la base de datos y la pantalla solo enseña el final.
  const pool = db();
  const row = (await pool.query(`select secret_enc, secret_hint from company_email_settings where company_id = (select id from companies where slug = 'demo')`)).rows[0];
  expect(row.secret_enc).not.toContain("buzon-secreto-123");
  expect(row.secret_hint).toBe("-123");
  await page.reload();
  expect(await page.content()).not.toContain("buzon-secreto-123");
  await expect(page.getByText("termina en ····-123")).toBeVisible();

  // Guardar sin volver a escribir la contraseña la conserva.
  await page.click("button:has-text('Guardar y enviar correo de prueba')");
  await expect(page.getByRole("status").filter({ hasText: "Conectado" })).toBeVisible();

  // Un aviso real: nueva solicitud desde el formulario web → sale por el correo de la empresa.
  await pool.query(`update automations set enabled = true where key = 'aviso_nueva_solicitud' and company_id = (select id from companies where slug = 'demo')`);
  await pool.end();
  await page.goto("/f/demo");
  await page.waitForTimeout(3200);
  await page.fill("#name", `Aviso Correo ${stamp}`);
  await page.fill("#email", `aviso${stamp}@cliente.example`);
  await page.fill("#location", "Oliva");
  await page.check("input[name=consent]");
  await page.click("button:has-text('Enviar solicitud')");
  await expect(page.getByText("Solicitud recibida")).toBeVisible();
  await expect.poll(received, { timeout: 15_000 }).toContain(`Aviso Correo ${stamp}`);
});

test("un comercial no puede ver ni cambiar el correo de envío", async ({ page }) => {
  await login(page, "comercial@demo.example");
  await page.goto("/ajustes/correo");
  await expect(page).toHaveURL(/\/ajustes\?aviso=sin_permiso/);
});
