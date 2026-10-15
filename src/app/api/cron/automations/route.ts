import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runAutomations } from "@/server/automations";
import { cleanupRateLimits } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Ejecuta automatizaciones y procesa la bandeja de emails.
 * Vercel Cron envía `Authorization: Bearer $CRON_SECRET` automáticamente.
 */
export async function GET(req: Request) {
  if (!env.cronSecret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const started = Date.now();
  try {
    const report = await runAutomations();
    await cleanupRateLimits();
    if (report.errors.length) console.error("[automatizaciones] errores", report.errors);
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...report });
  } catch (e) {
    console.error("[automatizaciones] fallo general", e);
    return NextResponse.json({ ok: false, error: "Fallo al ejecutar automatizaciones" }, { status: 500 });
  }
}
