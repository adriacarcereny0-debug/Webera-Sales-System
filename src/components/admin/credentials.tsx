"use client";
import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Credenciales recién creadas, listas para copiar y entregar al cliente. Se muestran una sola vez. */
export function CredentialsCard({ email, password, mustChange, appUrl, company }: { email: string; password: string; mustChange: boolean; appUrl: string; company?: string }) {
  const [copied, setCopied] = useState(false);
  const text = [
    `Acceso a Webora Studio${company ? ` · ${company}` : ""}`,
    `Dirección: ${appUrl}/login`,
    `Usuario: ${email}`,
    `Contraseña: ${password}`,
    mustChange ? "Al entrar por primera vez te pedirá elegir una contraseña propia." : "",
  ].filter(Boolean).join("\n");
  return (
    <div role="status" className="overflow-hidden rounded-lg bg-[#0f1528] text-white shadow-lift">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-[0.8rem] text-white/70">
        <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
        Credenciales para entregar al cliente · se muestran una sola vez
      </div>
      <dl className="grid gap-x-6 gap-y-2 px-4 py-4 text-[0.9rem] sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-white/55">Dirección</dt><dd className="font-mono break-all">{appUrl}/login</dd>
        <dt className="text-white/55">Usuario</dt><dd className="font-mono break-all">{email}</dd>
        <dt className="text-white/55">Contraseña</dt><dd className="font-mono text-[1.05rem] tracking-wide break-all text-[#fbf1c7]">{password}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3">
        <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
        }}>
          {copied ? <Check className="size-4 text-ok" strokeWidth={2} aria-hidden /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden />}
          {copied ? "Copiado" : "Copiar acceso"}
        </button>
        <span className="text-[0.78rem] text-white/55">{mustChange ? "Deberá cambiarla en su primer acceso." : "No se le pedirá cambiarla."} Envíala por un canal privado.</span>
      </div>
    </div>
  );
}
