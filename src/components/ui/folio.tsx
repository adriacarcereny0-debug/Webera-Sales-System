import { padFolio } from "@/lib/brand";
import { cn } from "@/lib/cn";

/** Número de folio en rojo de numeradora: la firma visual del talonario. */
export function Folio({ n, prefix = "Nº", className, width }: { n: number | string; prefix?: string; className?: string; width?: number }) {
  return (
    <span className={cn("folio whitespace-nowrap", className)}>
      <span className="mr-[0.2em] font-medium opacity-80">{prefix}</span>
      {typeof n === "number" || /^\d+$/.test(String(n)) ? padFolio(n, width) : n}
    </span>
  );
}
