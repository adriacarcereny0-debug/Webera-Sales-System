"use client";
import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { moveStage } from "../contactos/actions";
import { STAGE_META, STAGES, type Stage } from "@/lib/stages";
import { formatCents } from "@/lib/money";
import { padFolio } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";

export interface BoardCard {
  id: string; folio: string; name: string; city: string | null; service: string | null; amount: number | null;
  owner: string | null; nextAction: string | null; nextAt: string | null; nextLabel: string | null; overdue: boolean; stage: Stage;
}

export function PipelineBoard({ cards, canWrite, closedLimitNote }: { cards: BoardCard[]; canWrite: boolean; closedLimitNote: string }) {
  const [optimistic, applyMove] = useOptimistic(cards, (state, m: { id: string; stage: Stage }) =>
    state.map((c) => (c.id === m.id ? { ...c, stage: m.stage } : c)));
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function move(id: string, stage: Stage, lostReason?: string) {
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    if (stage === "perdido" && !lostReason) {
      setPendingLost(id);
      dialogRef.current?.showModal();
      return;
    }
    setError(null);
    startTransition(async () => {
      applyMove({ id, stage });
      const fd = new FormData();
      fd.set("id", id);
      fd.set("stage", stage);
      if (lostReason) fd.set("lost_reason", lostReason);
      const r = await moveStage(undefined, fd);
      if (r.error) setError(r.error);
    });
  }

  return (
    <>
      {error && <p role="alert" className="tint-rosa tint-chip mb-3 rounded-md px-3 py-2 text-sm">{error}</p>}
      <div className="relative -mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="grid min-w-max auto-cols-[17.5rem] grid-flow-col gap-3">
          {STAGES.map((stage) => {
            const list = optimistic.filter((c) => c.stage === stage);
            const total = list.reduce((a, c) => a + (c.amount ?? 0), 0);
            const meta = STAGE_META[stage];
            return (
              <section key={stage} aria-labelledby={`col-${stage}`}
                onDragOver={(e) => { if (canWrite && dragId) { e.preventDefault(); setOver(stage); } }}
                onDragLeave={() => setOver((o) => (o === stage ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); if (dragId) move(dragId, stage); setDragId(null); }}
                className={cn("flex min-h-64 flex-col md:max-h-[calc(100dvh-13rem)] rounded-lg bg-[color-mix(in_oklab,var(--paper)_60%,var(--rule))] transition-shadow",
                  over === stage && "shadow-[inset_0_0_0_2px_var(--brand)]")}>
                <header className={cn(meta.tint, "rounded-t-lg border-b border-[var(--t-line)] bg-[var(--t-bg)] px-3 py-2.5 text-[var(--t-fg)]")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id={`col-${stage}`} className="text-[0.88rem] font-semibold">{meta.label}</h2>
                    <span className="num text-[0.8rem] opacity-80">{list.length}</span>
                  </div>
                  <p className="num mt-0.5 text-[0.78rem] opacity-80">{total ? `${formatCents(total, { compact: true })} sin IVA` : "Sin importes"}</p>
                </header>
                <ol className="flex-1 space-y-2 overflow-y-auto p-2">
                  {list.length === 0 && <li className="px-2 py-6 text-center text-[0.8rem] text-muted">{canWrite ? "Arrastra aquí una oportunidad" : "Vacío"}</li>}
                  {list.map((c) => (
                    <li key={c.id} draggable={canWrite} onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      className={cn("group rounded-md bg-sheet p-3 shadow-sheet ring-1 ring-rule transition-[box-shadow,opacity]",
                        canWrite && "cursor-grab active:cursor-grabbing hover:ring-rule-strong", dragId === c.id && "opacity-50")}>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/contactos/${c.id}`} className="min-w-0 text-[0.9rem] font-medium leading-snug text-ink hover:underline">{c.name}</Link>
                        <span className="folio shrink-0 text-[0.8rem]">{padFolio(c.folio)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[0.78rem] text-muted">{[c.service, c.city].filter(Boolean).join(" · ") || "—"}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[0.78rem]">
                        <span className="num font-semibold text-ink">{c.amount ? formatCents(c.amount, { compact: true }) : <span className="font-normal text-faint">Sin importe</span>}</span>
                        <span className="truncate text-muted">{c.owner ?? <span className="text-warn">Sin asignar</span>}</span>
                      </div>
                      {c.nextLabel && (
                        <p className={cn("mt-2 truncate border-t border-dashed border-rule pt-2 text-[0.76rem]", c.overdue ? "font-medium text-danger" : "text-ink-2")}>
                          {c.overdue ? "Vencida · " : ""}{c.nextLabel}
                        </p>
                      )}
                      {canWrite && (
                        <div className="mt-2 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                          <label className="sr-only" htmlFor={`mv-${c.id}`}>Mover {c.name} a otra fase</label>
                          <select id={`mv-${c.id}`} value="" onChange={(e) => e.target.value && move(c.id, e.target.value as Stage)}
                            className="h-9 w-full cursor-pointer rounded border-0 bg-paper px-2 text-[0.78rem] text-ink-2 ring-1 ring-inset ring-rule focus:ring-2 focus:ring-brand md:h-7">
                            <option value="">Mover a…</option>
                            {STAGES.filter((s) => s !== c.stage).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                          </select>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-[0.8rem] text-muted">{closedLimitNote}</p>

      <dialog ref={dialogRef} aria-labelledby="lost-title" onClose={() => setPendingLost(null)}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-sheet p-0 text-ink shadow-lift ring-1 ring-rule backdrop:bg-[rgb(12_18_41/0.45)]">
        <form method="dialog" className="p-5" onSubmit={(e) => {
          const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
          if (pendingLost && reason) move(pendingLost, "perdido", reason);
          else e.preventDefault();
        }}>
          <h2 id="lost-title" className="font-semibold">Motivo de la pérdida</h2>
          <p className="mt-1 text-sm text-muted">Anotarlo ayuda a entender por qué no se cierran ventas.</p>
          <label htmlFor="reason" className="mt-4 mb-1.5 block text-[0.82rem] font-medium text-ink-2">Motivo</label>
          <input id="reason" name="reason" required autoFocus placeholder="Ej.: eligió otra oferta" className="h-10 w-full rounded-md px-3 text-sm ring-1 ring-inset ring-rule-strong focus:ring-2 focus:ring-brand focus:outline-none" />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <button type="submit" className={buttonClass("primary")}>Marcar como perdido</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
