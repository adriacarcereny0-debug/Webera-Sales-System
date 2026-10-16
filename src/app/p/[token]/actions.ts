"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { processOutbox } from "@/lib/email/outbox";
import { decidePublicQuote, isQuoteToken } from "@/server/quote-online";
import type { ActionState } from "@/lib/action-state";

const schema = z.object({
  decision: z.enum(["aceptado", "rechazado"]),
  note: z.string().trim().max(1000, "Máximo 1000 caracteres.").optional(),
});

export async function decideQuote(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  if (!isQuoteToken(token)) return { error: "Este enlace no es válido." };
  const ip = await clientIp();
  if (!(await rateLimit(`quote-decide:${ip}`, 10, 3600))) return { error: "Demasiados intentos. Inténtalo de nuevo más tarde." };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await decidePublicQuote(token, parsed.data.decision, parsed.data.note || null);
  if ("error" in res) return { error: res.error };
  await processOutbox({ limit: 5 }).catch(() => null);
  revalidatePath(`/p/${token}`);
  return { ok: true, message: parsed.data.decision };
}
