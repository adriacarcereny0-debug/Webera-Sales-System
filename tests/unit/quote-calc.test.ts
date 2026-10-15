import { describe, expect, it } from "vitest";
import { computeQuote, lineNetCents } from "@/lib/quotes/calc";

describe("cálculo de presupuestos", () => {
  it("calcula base, IVA y total de una línea simple", () => {
    const t = computeQuote([{ quantity: 1, unitPriceCents: 100000, discountPct: 0, taxRate: 21 }]);
    expect(t.subtotalCents).toBe(100000);
    expect(t.taxCents).toBe(21000);
    expect(t.totalCents).toBe(121000);
  });

  it("aplica cantidades decimales y descuentos con redondeo al céntimo", () => {
    // 2,5 m × 12,99 € = 32,475 € → descuento 10 % = 29,2275 € → 29,23 €
    expect(lineNetCents({ quantity: 2.5, unitPriceCents: 1299, discountPct: 10, taxRate: 21 })).toBe(2923);
  });

  it("desglosa el IVA por tipo y suma correctamente", () => {
    const t = computeQuote([
      { quantity: 1, unitPriceCents: 250000, discountPct: 0, taxRate: 21 },
      { quantity: 3, unitPriceCents: 3333, discountPct: 0, taxRate: 10 },
      { quantity: 1, unitPriceCents: 1000, discountPct: 0, taxRate: 0 },
    ]);
    expect(t.breakdown).toEqual([
      { rate: 21, baseCents: 250000, taxCents: 52500 },
      { rate: 10, baseCents: 9999, taxCents: 1000 },
      { rate: 0, baseCents: 1000, taxCents: 0 },
    ]);
    expect(t.subtotalCents).toBe(260999);
    expect(t.taxCents).toBe(53500);
    expect(t.totalCents).toBe(314499);
  });

  it("redondea medio céntimo hacia arriba", () => {
    // 0,105 € → 0,11 €
    expect(lineNetCents({ quantity: 1, unitPriceCents: 21, discountPct: 50, taxRate: 21 })).toBe(11);
    const t = computeQuote([{ quantity: 1, unitPriceCents: 50, discountPct: 0, taxRate: 21 }]);
    expect(t.taxCents).toBe(11); // 10,5 céntimos → 11
  });

  it("presupuesto vacío da cero", () => {
    expect(computeQuote([])).toMatchObject({ subtotalCents: 0, taxCents: 0, totalCents: 0, breakdown: [] });
  });
});
