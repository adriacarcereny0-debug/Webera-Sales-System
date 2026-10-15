import { defineConfig } from "@playwright/test";

/**
 * Pruebas de extremo a extremo contra una instancia en marcha (npm run dev o npm start)
 * con la demo cargada. Variables: E2E_BASE_URL, E2E_DATABASE_URL, DEMO_PASSWORD.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : undefined,
  },
});
