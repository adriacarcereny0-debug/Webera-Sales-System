import { cn } from "@/lib/cn";

/** Marca de Webera: una «W» trazada como una firma de bolígrafo, con el punto rojo del folio. */
export function WeberaMark({ size = 28, className, tone = "ink" }: { size?: number; className?: string; tone?: "ink" | "light" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={cn("shrink-0", className)}>
      <rect width="32" height="32" rx="7" fill={tone === "ink" ? "#23408e" : "#ffffff"} />
      <path d="M7 10.5 11.2 22.5 16 13.2 20.8 22.5 25 10.5" fill="none" stroke={tone === "ink" ? "#ffffff" : "#23408e"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.4" cy="6.6" r="2.2" fill="#c22d29" />
    </svg>
  );
}

export function WeberaWordmark({ className, tone = "ink", sub }: { className?: string; tone?: "ink" | "light"; sub?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <WeberaMark tone={tone === "ink" ? "ink" : "light"} />
      <span className="leading-none">
        <span className={cn("block text-[1.05rem] font-semibold tracking-[-0.02em]", tone === "ink" ? "text-ink" : "text-white")}>Webera</span>
        {sub && <span className={cn("mt-0.5 block text-[0.7rem] tracking-[0.01em]", tone === "ink" ? "text-muted" : "text-white/55")}>{sub}</span>}
      </span>
    </span>
  );
}
