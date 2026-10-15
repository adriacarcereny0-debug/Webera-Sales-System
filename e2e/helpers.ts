import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo-webera-2026";
export const db = () => new Pool({ connectionString: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL });

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/(panel|cuenta)/);
}
