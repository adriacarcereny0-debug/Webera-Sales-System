"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export interface Datum { label: string; value: number; display: string; hint?: string }

/**
 * Columnas de una sola serie (sin leyenda: el título nombra la serie).
 * Marcas finas (≤24px), extremo redondeado de 4px y base recta, valor en la punta,
 * rejilla mínima, tooltip al pasar/enfocar y tabla equivalente para lectores de pantalla.
 */
export function ColumnChart({ data, title, highlightLast = true, height = 180 }: { data: Datum[]; title: string; highlightLast?: boolean; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const allZero = data.every((d) => d.value === 0);
  return (
    <figure className="m-0">
      <div className="relative" style={{ height }} role="img" aria-labelledby={`${id}-cap`}>
        <div className="absolute inset-x-0 bottom-6 border-t border-rule" aria-hidden />
        <div className="absolute inset-x-0 top-0 bottom-6 flex items-end justify-around gap-2">
          {data.map((d, i) => {
            const h = d.value === 0 ? 0 : Math.max(3, (d.value / max) * (height - 50));
            const strong = (highlightLast && i === data.length - 1) || hover === i;
            return (
              <div key={d.label} className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end outline-none"
                tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${d.display}`}>
                {(strong || data.length <= 6) && !allZero && (
                  <span className={cn("num mb-1 text-[0.72rem] whitespace-nowrap", strong ? "font-semibold text-ink" : "text-muted")}>{d.display}</span>
                )}
                <span className={cn("w-full max-w-6 rounded-t-[4px] transition-colors duration-150",
                  strong ? "bg-brand" : "bg-[color-mix(in_oklab,var(--brand)_45%,white)]")} style={{ height: h }} />
                {hover === i && d.hint && (
                  <span role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md bg-ink px-2 py-1 text-[0.72rem] whitespace-nowrap text-white shadow-lift">{d.hint}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-around gap-2" aria-hidden>
          {data.map((d) => <span key={d.label} className="flex-1 text-center text-[0.72rem] text-muted">{d.label}</span>)}
        </div>
        {allZero && <p className="absolute inset-0 flex items-center justify-center text-[0.82rem] text-muted">Sin datos en este periodo</p>}
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">{title}</figcaption>
      <DataTable title={title} data={data} />
    </figure>
  );
}

/** Barras horizontales de una serie, con la etiqueta a la izquierda y el valor en la punta. */
export function BarList({ data, title }: { data: Datum[]; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) return <p className="py-6 text-center text-[0.82rem] text-muted">Sin datos todavía</p>;
  return (
    <figure className="m-0">
      <ul className="space-y-2.5" aria-label={title}>
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-[0.82rem] sm:grid-cols-[minmax(6.5rem,38%)_minmax(0,1fr)]" title={d.hint}>
            <span className="truncate text-ink-2">{d.label}</span>
            <span className="flex items-center gap-2">
              <span className="h-3 rounded-r-[4px] bg-brand" style={{ width: `${d.value === 0 ? 0 : Math.max(1.5, (d.value / max) * 70)}%` }} aria-hidden />
              <span className="num shrink-0 text-ink">{d.display}</span>
            </span>
          </li>
        ))}
      </ul>
      <DataTable title={title} data={data} />
    </figure>
  );
}

function DataTable({ title, data }: { title: string; data: Datum[] }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <tbody>{data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th><td>{d.display}</td></tr>)}</tbody>
    </table>
  );
}
