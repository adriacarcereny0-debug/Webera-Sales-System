"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Step {
  tint: string;
  stage: string;
  title: string;
  text: string;
  rows: [string, string][];
  footer: string;
}

// Ejemplo ilustrativo: el recorrido de una solicitud dentro de Webera.
const STEPS: Step[] = [
  {
    tint: "tint-blanca", stage: "Nueva solicitud", title: "Un cliente te escribe desde tu web",
    text: "Rellena el formulario de tu página. Al momento aparece aquí con su número, y te llega un aviso.",
    rows: [["Nombre", "Marta S."], ["Localidad", "Gandia"], ["Quiere", "Aerotermia"], ["Plazo", "En el próximo mes"]],
    footer: "Recibida hace 2 minutos",
  },
  {
    tint: "tint-amarilla", stage: "Pendiente de llamar", title: "Alguien se encarga de llamarla",
    text: "Le asignas un responsable y una próxima acción con fecha. Si se olvida, el sistema crea una tarea y avisa.",
    rows: [["Responsable", "Àlex"], ["Próximo paso", "Llamar"], ["Cuándo", "Hoy, 17:00"], ["Notas", "Casa de 140 m²"]],
    footer: "Nadie se queda sin respuesta",
  },
  {
    tint: "tint-azul", stage: "Visita programada", title: "Se agenda la visita técnica",
    text: "La visita entra en la agenda del técnico y le llega un recordatorio el día antes.",
    rows: [["Día", "Jueves"], ["Hora", "10:30 – 11:30"], ["Lugar", "C/ Mayor 12, Gandia"], ["Técnico", "Sergio"]],
    footer: "Recordatorio automático",
  },
  {
    tint: "tint-rosa", stage: "Presupuesto enviado", title: "Presupuesto revisado y enviado",
    text: "Preparas el presupuesto con tus precios, alguien lo revisa y se descarga en PDF con tu logotipo.",
    rows: [["Equipo aerotermia", "6.900 €"], ["Instalación", "1.650 €"], ["IVA 21 %", "1.795,50 €"], ["Total", "10.345,50 €"]],
    footer: "Si no contesta en 3 días, te lo recuerda",
  },
  {
    tint: "tint-verde", stage: "Ganado", title: "Aceptado: ya es tu cliente",
    text: "Lo marcas como aceptado y el panel suma la venta. Ves de un vistazo cuánto vendes y de dónde llegan.",
    rows: [["Estado", "Aceptado"], ["Venta", "8.550 € sin IVA"], ["Origen", "Formulario web"], ["Días hasta cerrar", "12"]],
    footer: "Cuenta en tus resultados",
  },
];

/** Posición visual de cada ficha según su distancia a la ficha de delante. */
function place(depth: number) {
  if (depth === 0) return { transform: "translate3d(0,0,0) rotate(-1deg)", opacity: 1, zIndex: 30 };
  if (depth === 1) return { transform: "translate3d(14px,14px,0) rotate(2deg) scale(0.975)", opacity: 1, zIndex: 20 };
  if (depth === 2) return { transform: "translate3d(28px,28px,0) rotate(4.5deg) scale(0.95)", opacity: 1, zIndex: 10 };
  return { transform: "translate3d(28px,28px,0) rotate(4.5deg) scale(0.95)", opacity: 0, zIndex: 0 };
}

export function StoryDeck({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const n = STEPS.length;
  const [i, setI] = useState(0);
  const [thrown, setThrown] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((next: number, dir: 1 | -1 = 1) => {
    const target = ((next % n) + n) % n;
    if (dir === 1) setThrown(i);
    setI(target);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setThrown(null), 650);
  }, [i, n]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const s = STEPS[i];
  const light = tone === "light";

  return (
    <div className="grid grid-cols-1 gap-8">
      {/* Explicación del paso */}
      <div className="order-2" aria-live="polite">
        <p className={cn("text-[0.8rem] font-medium", light ? "text-muted" : "text-white/55")}>Paso {i + 1} de {n}</p>
        <h2 key={`t${i}`} className={cn("deck-fade mt-2 text-[1.45rem] leading-tight font-semibold tracking-[-0.02em] text-balance", light ? "text-ink" : "text-white")}>{s.title}</h2>
        <p key={`p${i}`} className={cn("deck-fade mt-3 max-w-md text-[0.98rem] leading-relaxed", light ? "text-ink-2" : "text-white/75")}>{s.text}</p>
        <div className="mt-7 flex items-center gap-3">
          <button type="button" onClick={() => go(i - 1, -1)} aria-label="Paso anterior"
            className={cn("inline-flex size-10 items-center justify-center rounded-full transition-colors", light ? "text-ink-2 ring-1 ring-rule-strong hover:bg-sheet" : "text-white/80 ring-1 ring-white/25 hover:bg-white/10")}>
            <ArrowLeft className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => go(i + 1)} className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.9rem] font-medium transition-colors",
            light ? "bg-brand text-brand-contrast hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]" : "bg-white text-[#0c1229] hover:bg-white/90")}>
            {i === n - 1 ? "Volver a empezar" : "Siguiente paso"}<ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <ol className="ml-2 flex items-center gap-1.5" aria-label="Pasos">
            {STEPS.map((st, k) => (
              <li key={st.stage}>
                <button type="button" onClick={() => go(k, k > i ? 1 : -1)} aria-label={`Paso ${k + 1}: ${st.stage}`} aria-current={k === i ? "step" : undefined}
                  className={cn("block h-1.5 rounded-full transition-all duration-300", k === i ? "w-6" : "w-1.5",
                    k === i ? (light ? "bg-brand" : "bg-white") : (light ? "bg-rule-strong hover:bg-muted" : "bg-white/30 hover:bg-white/60"))} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Pila de fichas */}
      <div className="order-1">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Ficha de ejemplo: ${s.stage}. Pulsa para ver el siguiente paso.`}
          onClick={() => go(i + 1)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1, -1); }
          }}
          className="group relative h-[17.5rem] w-full max-w-[26rem] pr-7 cursor-pointer outline-none select-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
        >
          {STEPS.map((st, k) => {
            const depth = (k - i + n) % n;
            const isThrown = thrown === k;
            return (
              <article key={st.stage} aria-hidden={depth !== 0}
                style={isThrown ? undefined : place(depth)}
                className={cn("absolute inset-x-0 top-0 flex h-64 overflow-hidden rounded-lg bg-white text-ink shadow-[0_28px_60px_-24px_rgb(0_0_0/0.55)] ring-1 ring-black/5",
                  "transition-[transform,opacity] duration-500 ease-[var(--ease-out)] will-change-transform",
                  depth === 0 && !isThrown && "group-hover:-translate-y-1",
                  isThrown && "deck-throw")}>
                <div className={cn(st.tint, "flex w-[6.25rem] shrink-0 flex-col justify-between border-r border-dashed border-[var(--t-line)] bg-[var(--t-bg)] px-3 py-4")}>
                  <p className="folio text-[0.95rem] whitespace-nowrap">Nº 000128</p>
                  <p className="text-[0.66rem] leading-snug text-[var(--t-fg)] opacity-80">Ejemplo ilustrativo</p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(st.tint, "tint-chip inline-flex h-6 items-center rounded-[4px] px-2 text-[0.74rem] font-semibold")}>{st.stage}</span>
                    <span className="text-[0.7rem] text-muted">{k + 1}/{n}</span>
                  </div>
                  <dl className="mt-3 flex-1 divide-y divide-rule text-[0.84rem]">
                    {st.rows.map(([a, b]) => (
                      <div key={a} className="flex items-center justify-between gap-4 py-[0.42rem]">
                        <dt className="text-muted">{a}</dt>
                        <dd className="num truncate text-right font-medium">{b}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="flex items-center gap-1.5 text-[0.74rem] text-muted"><Check className="size-3.5 text-ok" strokeWidth={2.25} aria-hidden />{st.footer}</p>
                </div>
                {st.tint === "tint-verde" && (
                  <span aria-hidden className="pointer-events-none absolute right-5 bottom-10 -rotate-12 rounded-md border-2 border-[#1b5a31] px-2.5 py-1 text-[0.8rem] font-bold tracking-[0.12em] text-[#1b5a31] uppercase opacity-80">Aceptado</span>
                )}
              </article>
            );
          })}
        </div>
        <p className={cn("mt-4 max-w-[26rem] text-center text-[0.78rem]", light ? "text-muted" : "text-white/45")}>Pulsa la ficha para pasar a la siguiente</p>
      </div>
    </div>
  );
}
