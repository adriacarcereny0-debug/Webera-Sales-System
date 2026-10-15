"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "./button";

export function CopyField({ value, label, multiline }: { value: string; label: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <label className="sr-only">{label}</label>
      {multiline ? (
        <pre className="max-h-56 overflow-auto rounded-md bg-[#0f1528] p-3 text-[0.78rem] leading-relaxed whitespace-pre-wrap break-all text-[#dfe5f5]"><code>{value}</code></pre>
      ) : (
        <p className="truncate rounded-md bg-paper px-3 py-2 font-mono text-[0.82rem] ring-1 ring-inset ring-rule">{value}</p>
      )}
      <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
      }}>
        {copied ? <Check className="size-4 text-ok" strokeWidth={2} aria-hidden /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden />}
        {copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}
      </button>
    </div>
  );
}
