/**
 * Cálculo de presupuestos en céntimos enteros para evitar errores de coma flotante.
 *
 * - Base de línea = cantidad × precio unitario × (1 − descuento%), redondeada al céntimo.
 * - El IVA se calcula por tipo impositivo sobre la suma de bases de ese tipo
 *   (desglose por tipo, como en una factura española) y se redondea al céntimo.
 *
 * Importante: este cálculo es aritmético. La elección del tipo de IVA aplicable
 * (21 %, 10 % en determinadas obras de renovación de vivienda, etc.) es
 * responsabilidad de la empresa y su asesoría; el sistema no la valida.
 */
export interface QuoteLineInput {
  quantity: number;
  unitPriceCents: number;
  discountPct: number;
  taxRate: number;
}

export interface TaxBreakdown {
  rate: number;
  baseCents: number;
  taxCents: number;
}

export interface QuoteTotals {
  lines: number[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  breakdown: TaxBreakdown[];
}

function roundHalfUp(n: number): number {
  // Redondeo comercial (0,5 hacia arriba) estable ante errores binarios.
  return Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON * Math.abs(n));
}

export function lineNetCents(l: QuoteLineInput): number {
  const gross = l.quantity * l.unitPriceCents;
  const net = gross * (1 - l.discountPct / 100);
  return roundHalfUp(Number(net.toFixed(6)));
}

export function computeQuote(lines: QuoteLineInput[]): QuoteTotals {
  const nets = lines.map(lineNetCents);
  const byRate = new Map<number, number>();
  lines.forEach((l, i) => byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + nets[i]));
  const breakdown = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, baseCents]) => ({ rate, baseCents, taxCents: roundHalfUp(Number(((baseCents * rate) / 100).toFixed(6))) }));
  const subtotalCents = nets.reduce((a, b) => a + b, 0);
  const taxCents = breakdown.reduce((a, b) => a + b.taxCents, 0);
  return { lines: nets, subtotalCents, taxCents, totalCents: subtotalCents + taxCents, breakdown };
}
