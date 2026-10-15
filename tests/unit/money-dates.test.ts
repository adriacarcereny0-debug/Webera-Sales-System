import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseDecimal, parseEuroToCents } from "@/lib/money";
import { dateToMadridLocal, madridLocalToDate, todayMadrid } from "@/lib/dates";

describe("importes", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1 234,5", 123450],
    ["€ 12", 1200],
    ["1.234", 123400],
    ["12.5", 1250],
    ["0,07", 7],
    ["1,234.50", 123450],
  ])("interpreta %s", (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });

  it("rechaza texto no numérico", () => {
    expect(parseEuroToCents("doce")).toBeNull();
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("1,2,3a")).toBeNull();
  });

  it("formatea y vuelve a formulario", () => {
    expect(formatCents(123456).replace(/\u00a0/g, " ")).toBe("1.234,56 €");
    expect(formatCents(980000, { compact: true }).replace(/\u00a0/g, " ")).toBe("9.800 €");
    expect(centsToInput(123456)).toBe("1234,56");
    expect(parseDecimal("2,5")).toBe(2.5);
  });
});

describe("fechas en Madrid", () => {
  it("convierte hora local de verano a UTC", () => {
    expect(madridLocalToDate("2026-07-10T10:00")!.toISOString()).toBe("2026-07-10T08:00:00.000Z");
  });
  it("convierte hora local de invierno a UTC", () => {
    expect(madridLocalToDate("2026-01-10T10:00")!.toISOString()).toBe("2026-01-10T09:00:00.000Z");
  });
  it("ida y vuelta", () => {
    expect(dateToMadridLocal(madridLocalToDate("2026-10-25T18:30"))).toBe("2026-10-25T18:30");
  });
  it("día de hoy en Madrid cerca de medianoche UTC", () => {
    expect(todayMadrid(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });
});
