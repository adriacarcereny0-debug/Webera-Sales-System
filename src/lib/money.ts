// useGrouping "always": 9.800 € y 11.500 € con el mismo formato en tablas.
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" } as Intl.NumberFormatOptions);
const eur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);

export function formatCents(cents: number | bigint | string | null | undefined, opts: { compact?: boolean } = {}): string {
  if (cents === null || cents === undefined || cents === "") return "—";
  const n = Number(cents) / 100;
  return opts.compact ? eur0.format(n) : eur.format(n);
}

/**
 * Convierte un importe escrito por una persona en España a céntimos.
 * Acepta "1.234,56", "1234,56", "1234.56", "1 234,5", "€ 12". Devuelve null si no es válido.
 */
export function parseEuroToCents(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[€\s ]/g, "");
  if (s === "") return null;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  if (!/^[0-9.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // El separador que aparece último es el decimal.
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    normalized = (s.match(/,/g)!.length === 1 && decimals <= 2) ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    // "1.234" en España es mil doscientos treinta y cuatro; "12.5" es decimal.
    normalized = (s.match(/\./g)!.length === 1 && decimals <= 2) ? s : s.replace(/\./g, "");
  } else {
    normalized = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [int, dec = ""] = normalized.split(".");
  if (dec.length > 2) {
    const value = Math.round(Number(normalized) * 100);
    return neg ? -value : value;
  }
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const n = Number(cents);
  const abs = Math.abs(n);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return n < 0 ? `-${s}` : s;
}

/** Número decimal en formato español ("2,5"). */
export function parseDecimal(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s/g, "");
  if (s === "") return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function formatDecimal(n: number | string, maxDecimals = 3): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: maxDecimals }).format(Number(n));
}
