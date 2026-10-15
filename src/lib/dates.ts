/** Utilidades de fecha en horario peninsular (Europe/Madrid). */
export const TZ = "Europe/Madrid";

const dateFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateLongFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const shortDayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const monthFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, month: "short" });

type D = Date | string | null | undefined;
const toDate = (d: D) => (d ? (d instanceof Date ? d : new Date(d)) : null);

export const fmtDate = (d: D) => (toDate(d) ? dateFmt.format(toDate(d)!) : "—");
export const fmtDateLong = (d: D) => (toDate(d) ? dateLongFmt.format(toDate(d)!) : "—");
export const fmtDateTime = (d: D) => (toDate(d) ? dateTimeFmt.format(toDate(d)!) : "—");
export const fmtTime = (d: D) => (toDate(d) ? timeFmt.format(toDate(d)!) : "—");
export const fmtWeekday = (d: D) => (toDate(d) ? weekdayFmt.format(toDate(d)!) : "—");
export const fmtShortDay = (d: D) => (toDate(d) ? shortDayFmt.format(toDate(d)!) : "—");
export const fmtMonth = (d: D) => (toDate(d) ? monthFmt.format(toDate(d)!).replace(".", "") : "—");

/** Partes de calendario de una fecha en Madrid. */
export function madridParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Desfase (minutos) de Madrid respecto a UTC en un instante dado. */
function offsetMinutes(at: Date): number {
  const p = madridParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Convierte "YYYY-MM-DDTHH:mm" (hora de Madrid, de un input datetime-local) a Date UTC. */
export function madridLocalToDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  let ts = guess - offsetMinutes(new Date(guess)) * 60000;
  // Segunda pasada por si el cambio de hora cae entre medias.
  ts = guess - offsetMinutes(new Date(ts)) * 60000;
  const out = new Date(ts);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** Date → "YYYY-MM-DDTHH:mm" en hora de Madrid (para inputs datetime-local). */
export function dateToMadridLocal(d: D): string {
  const dt = toDate(d);
  if (!dt) return "";
  const p = madridParts(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Fecha de hoy en Madrid como "YYYY-MM-DD". */
export function todayMadrid(now = new Date()): string {
  const p = madridParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** "hace 3 días", "en 2 horas"… */
export function relative(d: D, now = new Date()): string {
  const dt = toDate(d);
  if (!dt) return "—";
  const diff = dt.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const abs = Math.abs(diff);
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return fmtDate(dt);
}
