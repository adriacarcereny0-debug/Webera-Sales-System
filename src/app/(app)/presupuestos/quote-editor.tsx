"use client";
import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GripVertical, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { saveQuote, type QuoteActionState } from "./actions";
import { computeQuote } from "@/lib/quotes/calc";
import { formatCents, parseDecimal, parseEuroToCents } from "@/lib/money";
import { Field, Input, Select, Textarea, controlClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface EditorLine { key: string; description: string; quantity: string; unit: string; unit_price: string; discount: string; tax_rate: string }
export interface EditorDefaults {
  id?: string; contact_id: string; title: string; issue_date: string; valid_until: string; notes: string; next_step: string; terms: string; lines: EditorLine[];
}

let seq = 0;
// Claves deterministas (l0, l1…) para que el HTML del servidor y el del cliente coincidan.
export const newLine = (taxRate: number): EditorLine => ({ key: `l${seq++}`, description: "", quantity: "1", unit: "ud", unit_price: "", discount: "", tax_rate: String(taxRate) });

const UNITS = ["ud", "m", "m²", "h", "kW", "kWp", "jornada", "lote"];

export function QuoteEditor({
  defaults, contacts, taxRates, defaultTax, cancelHref,
}: { defaults: EditorDefaults; contacts: { id: string; label: string }[]; taxRates: number[]; defaultTax: number; cancelHref: string }) {
  const [state, action] = useActionState<QuoteActionState, FormData>(saveQuote, {});
  const [lines, setLines] = useState<EditorLine[]>(() =>
    defaults.lines.length ? defaults.lines.map((l, i) => ({ ...l, key: `l${i}` })) : [{ ...newLine(defaultTax), key: "l0" }]);
  const nextKey = useRef(Math.max(defaults.lines.length, 1));
  const addLine = () => setLines((ls) => [...ls, { ...newLine(defaultTax), key: `l${nextKey.current++}` }]);

  const parsed = useMemo(() => lines.map((l) => ({
    quantity: parseDecimal(l.quantity) ?? 0,
    unitPriceCents: parseEuroToCents(l.unit_price) ?? 0,
    discountPct: Math.min(100, Math.max(0, parseDecimal(l.discount) ?? 0)),
    taxRate: Number(l.tax_rate),
  })), [lines]);
  const totals = useMemo(() => computeQuote(parsed), [parsed]);

  const update = (i: number, patch: Partial<EditorLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...newLine(defaultTax), key: `l${nextKey.current++}` }]));
  const moveLine = (i: number, dir: -1 | 1) => setLines((ls) => {
    const j = i + dir;
    if (j < 0 || j >= ls.length) return ls;
    const copy = [...ls];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  const payload = JSON.stringify(lines.map(({ key: _k, ...rest }) => rest));
  const lineErr = state.lineErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="items" value={payload} />
      {state.error && <Notice kind="error">{state.error}</Notice>}

      <section className="rounded-lg bg-sheet shadow-sheet ring-1 ring-rule">
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr]">
          <Field label="Cliente" htmlFor="contact_id">
            <Select id="contact_id" name="contact_id" defaultValue={defaults.contact_id} required>
              <option value="">Elige un contacto…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Título" htmlFor="title">
            <Input id="title" name="title" defaultValue={defaults.title} required />
          </Field>
          <Field label="Fecha" htmlFor="issue_date">
            <Input id="issue_date" name="issue_date" type="date" defaultValue={defaults.issue_date} required />
          </Field>
          <Field label="Válido hasta" htmlFor="valid_until">
            <Input id="valid_until" name="valid_until" type="date" defaultValue={defaults.valid_until} required />
          </Field>
        </div>
      </section>

      <section aria-labelledby="lines-title" className="rounded-lg bg-sheet shadow-sheet ring-1 ring-rule">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3 md:px-5">
          <h2 id="lines-title" className="font-semibold">Conceptos</h2>
          <p className="text-[0.8rem] text-muted">Precios sin IVA. Cantidades con coma decimal: 2,5</p>
        </div>

        <div className="hidden grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_5.5rem_7.5rem_5rem_5.5rem_7rem_4.5rem] gap-2 border-b border-rule px-4 py-2 text-[0.75rem] font-medium text-muted lg:grid md:px-5">
          <span /><span>Concepto</span><span>Cantidad</span><span>Unidad</span><span className="text-right">Precio ud.</span><span>Dto. %</span><span>IVA</span><span className="text-right">Importe</span><span />
        </div>

        <ol className="divide-y divide-rule">
          {lines.map((l, i) => (
            <li key={l.key} className={cn("grid grid-cols-2 gap-2 px-4 py-3 md:px-5 lg:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_5.5rem_7.5rem_5rem_5.5rem_7rem_4.5rem] lg:items-start", lineErr[i] && "bg-[#fdf2f5]")}>
              <span className="hidden pt-2.5 text-faint lg:block" aria-hidden><GripVertical className="size-4" strokeWidth={1.5} /></span>
              <div className="col-span-2 lg:col-span-1">
                <label className="sr-only" htmlFor={`d-${l.key}`}>Concepto de la línea {i + 1}</label>
                <textarea id={`d-${l.key}`} rows={1} value={l.description} onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="Descripción del equipo, material o trabajo" maxLength={500}
                  className={cn(controlClass, "field-sizing-content min-h-11 resize-none py-2 leading-snug md:min-h-9")} />
                {lineErr[i] && <p className="mt-1 text-[0.8rem] text-danger">{lineErr[i]}</p>}
              </div>
              <label className="text-[0.75rem] text-muted lg:contents"><span className="lg:sr-only">Cantidad</span>
                <Input inputMode="decimal" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className="num" aria-label={`Cantidad línea ${i + 1}`} />
              </label>
              <label className="text-[0.75rem] text-muted lg:contents"><span className="lg:sr-only">Unidad</span>
                <Select value={l.unit} onChange={(e) => update(i, { unit: e.target.value })} aria-label={`Unidad línea ${i + 1}`}>
                  {[...new Set([...UNITS, l.unit])].map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </label>
              <label className="text-[0.75rem] text-muted lg:contents"><span className="lg:sr-only">Precio unitario (€)</span>
                <Input inputMode="decimal" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} placeholder="0,00" className="num lg:text-right" aria-label={`Precio unitario línea ${i + 1}`} />
              </label>
              <label className="text-[0.75rem] text-muted lg:contents"><span className="lg:sr-only">Descuento %</span>
                <Input inputMode="decimal" value={l.discount} onChange={(e) => update(i, { discount: e.target.value })} placeholder="0" className="num" aria-label={`Descuento línea ${i + 1}`} />
              </label>
              <label className="text-[0.75rem] text-muted lg:contents"><span className="lg:sr-only">IVA</span>
                <Select value={l.tax_rate} onChange={(e) => update(i, { tax_rate: e.target.value })} aria-label={`IVA línea ${i + 1}`}>
                  {taxRates.map((r) => <option key={r} value={String(r)}>{r} %</option>)}
                </Select>
              </label>
              <p className="num col-span-1 self-center text-right text-sm font-medium lg:pt-0">
                <span className="mr-2 text-[0.75rem] font-normal text-muted lg:hidden">Importe</span>{formatCents(totals.lines[i] ?? 0)}
              </p>
              <div className="col-span-1 flex justify-end gap-0.5">
                <button type="button" onClick={() => moveLine(i, -1)} disabled={i === 0} aria-label={`Subir línea ${i + 1}`} className="flex size-9 items-center justify-center rounded text-faint hover:bg-paper hover:text-ink disabled:opacity-30 lg:size-7"><ArrowUp className="size-4" strokeWidth={1.6} /></button>
                <button type="button" onClick={() => moveLine(i, 1)} disabled={i === lines.length - 1} aria-label={`Bajar línea ${i + 1}`} className="flex size-9 items-center justify-center rounded text-faint hover:bg-paper hover:text-ink disabled:opacity-30 lg:size-7"><ArrowDown className="size-4" strokeWidth={1.6} /></button>
                <button type="button" onClick={() => remove(i)} aria-label={`Eliminar línea ${i + 1}`} className="flex size-9 items-center justify-center rounded text-faint hover:bg-paper hover:text-danger lg:size-7"><Trash2 className="size-4" strokeWidth={1.6} /></button>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-5 border-t border-rule p-4 md:flex-row md:items-start md:justify-between md:p-5">
          <button type="button" onClick={addLine} className={buttonClass("secondary")}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />Añadir línea
          </button>
          <dl className="num w-full max-w-sm space-y-1.5 text-sm" aria-live="polite">
            <div className="flex justify-between"><dt className="text-muted">Base imponible</dt><dd>{formatCents(totals.subtotalCents)}</dd></div>
            {totals.breakdown.map((b) => (
              <div key={b.rate} className="flex justify-between"><dt className="text-muted">IVA {b.rate} % sobre {formatCents(b.baseCents)}</dt><dd>{formatCents(b.taxCents)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-rule-strong pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatCents(totals.totalCents)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg bg-sheet p-4 shadow-sheet ring-1 ring-rule md:grid-cols-2 md:p-5">
        <Field label="Observaciones para el cliente" htmlFor="notes" optional hint="Aparecen en el documento.">
          <Textarea id="notes" name="notes" rows={4} defaultValue={defaults.notes} />
        </Field>
        <Field label="Condiciones" htmlFor="terms" optional hint="Forma de pago, garantías, plazos. Por defecto, las de Ajustes.">
          <Textarea id="terms" name="terms" rows={4} defaultValue={defaults.terms} />
        </Field>
        <Field label="Próximo paso (interno)" htmlFor="next_step" optional hint="No aparece en el documento." className="md:col-span-2">
          <Input id="next_step" name="next_step" defaultValue={defaults.next_step} placeholder="Ej.: Llamar el jueves para resolver dudas" />
        </Field>
      </section>

      <Notice kind="info">
        Los importes se calculan automáticamente con redondeo al céntimo. El tipo de IVA aplicable a cada concepto lo decide tu empresa: el sistema no valida si procede un tipo reducido.
      </Notice>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-lg md:border md:px-4">
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancelar</Link>
        <SubmitButton pendingLabel="Guardando…">Guardar borrador</SubmitButton>
      </div>
    </form>
  );
}
