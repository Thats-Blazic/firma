/**
 * Time-zone helpers. Trips are stored as UTC instants (timestamptz); the administrator and
 * customers always think in the business time zone (Europe/Belgrade by default, configurable).
 */

const MONTHS = [
  "januara", "februara", "marta", "aprila", "maja", "juna",
  "jula", "avgusta", "septembra", "oktobra", "novembra", "decembra",
];
const MONTHS_NOMINATIVE = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];
const WEEKDAYS_SHORT = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const WEEKDAYS_LONG = ["ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota", "nedelja"];

export const monthName = (monthIndex: number) => MONTHS_NOMINATIVE[monthIndex];
export const weekdayShort = (mondayFirstIndex: number) => WEEKDAYS_SHORT[mondayFirstIndex];
export const weekdayLong = (mondayFirstIndex: number) => WEEKDAYS_LONG[mondayFirstIndex];

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

function zonedParts(ms: number, tz: string): Parts {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

function offsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "2026-10-16" + "14:30" in `tz` → the matching UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(guess, tz);
  // Re-evaluate the offset at the result to stay correct across daylight-saving switches.
  return new Date(guess - offsetMs(first, tz));
}

export function toZoned(iso: string | Date, tz: string): { date: string; time: string; weekday: number } {
  const ms = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const p = zonedParts(ms, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayOfWeek = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = Sunday
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    weekday: (dayOfWeek + 6) % 7, // 0 = Monday
  };
}

/** Today's date in the business time zone. */
export function todayIn(tz: string): string {
  return toZoned(new Date(), tz).date;
}

export function formatDateSrFromKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}.`;
}

export function formatDateTimeSr(iso: string, tz: string): string {
  const z = toZoned(iso, tz);
  return `${formatDateSrFromKey(z.date)} u ${z.time}`;
}

export function formatDateShort(iso: string, tz: string): string {
  const z = toZoned(iso, tz);
  const [y, m, d] = z.date.split("-");
  return `${d}.${m}.${y}.`;
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Monday-first weekday (0..6) of a calendar date key. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** UTC instants bounding a calendar month in `tz` (end exclusive). */
export function monthBounds(year: number, monthIndex: number, tz: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = zonedToUtc(`${year}-${pad(monthIndex + 1)}-01`, "00:00", tz);
  const ny = monthIndex === 11 ? year + 1 : year;
  const nm = monthIndex === 11 ? 0 : monthIndex + 1;
  const end = zonedToUtc(`${ny}-${pad(nm + 1)}-01`, "00:00", tz);
  return { start, end };
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}
