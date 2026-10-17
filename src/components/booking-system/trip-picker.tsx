"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/reservations/pricing";
import {
  addDaysToKey,
  daysInMonth,
  formatDateSrFromKey,
  monthKey,
  monthName,
  todayIn,
  weekdayOfKey,
  weekdayShort,
  zonedToUtc,
} from "@/lib/reservations/time";
import type { DayInfo, MonthAvailability } from "@/lib/reservations/public-data";

export type PickedTrip = {
  tripId: string;
  date: string;
  time: string;
  remaining: number;
  unitPrice: number;
};

type Props = {
  routeId: string;
  timezone: string;
  currency: string;
  maxWindowDays: number;
  /** Only departures after this ISO instant are offered (return leg). */
  notBefore?: string | null;
  /** Month to show first (YYYY-MM). */
  initialMonth?: string;
  value: PickedTrip | null;
  onChange: (trip: PickedTrip | null) => void;
  pricingMode: "per_person" | "per_vehicle";
  idPrefix: string;
  /** Bump to force a re-fetch (e.g. after the server reported a slot was taken). */
  refreshToken?: number;
};

type Loaded = { key: string; data?: MonthAvailability; error?: boolean };

export function TripPicker({
  routeId,
  timezone,
  currency,
  maxWindowDays,
  notBefore,
  initialMonth,
  value,
  onChange,
  pricingMode,
  idPrefix,
  refreshToken = 0,
}: Props) {
  const today = useMemo(() => todayIn(timezone), [timezone]);
  const [cursor, setCursor] = useState(() => {
    const base = initialMonth ?? today.slice(0, 7);
    const [y, m] = base.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  });
  const [activeDate, setActiveDate] = useState<string | null>(value?.date ?? null);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const month = monthKey(cursor.year, cursor.monthIndex);
  const requestKey = `${routeId}|${month}|${notBefore ?? ""}|${nonce}|${refreshToken}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ routeId, month });
    if (notBefore) params.set("notBefore", notBefore);
    fetch(`/api/booking/availability?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<MonthAvailability>;
      })
      .then((data) => setLoaded({ key: requestKey, data }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key: requestKey, error: true });
      });
    return () => controller.abort();
  }, [requestKey, routeId, month, notBefore]);

  const loading = loaded?.key !== requestKey;
  const data = !loading ? loaded?.data : undefined;
  const failed = !loading && loaded?.error;

  const lastBookable = addDaysToKey(today, maxWindowDays).slice(0, 7);

  const canPrev = month > today.slice(0, 7);
  const canNext = month < lastBookable;

  const go = (delta: number) => {
    setCursor((c) => {
      const idx = c.year * 12 + c.monthIndex + delta;
      return { year: Math.floor(idx / 12), monthIndex: idx % 12 };
    });
  };

  const total = daysInMonth(cursor.year, cursor.monthIndex);
  const offset = weekdayOfKey(`${month}-01`);
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  const minNotBeforeDate = notBefore ? notBefore.slice(0, 10) : null;
  const dayInfo = (date: string): DayInfo | undefined => data?.days[date];

  const pickDate = (date: string) => {
    setActiveDate(date);
    const info = dayInfo(date);
    if (info?.trips.length === 1) {
      const t = info.trips[0];
      onChange({ tripId: t.id, date, time: t.time, remaining: t.remaining, unitPrice: t.unitPrice });
    } else if (value && value.date !== date) {
      onChange(null);
    }
  };

  const activeInfo = activeDate ? dayInfo(activeDate) : undefined;
  const noTripsAtAll = data && Object.keys(data.days).length === 0;
  const headingId = `${idPrefix}-month`;

  return (
    <div className="rounded-2xl border border-line bg-field/40 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 id={headingId} aria-live="polite" className="text-base font-semibold sm:text-lg">
          {monthName(cursor.monthIndex)} {cursor.year}.
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={!canPrev}
            aria-label="Prethodni mesec"
            className="grid size-9 place-items-center rounded-lg border border-line text-fg transition-colors hover:border-white/40 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={!canNext}
            aria-label="Sledeći mesec"
            className="grid size-9 place-items-center rounded-lg border border-line text-fg transition-colors hover:border-white/40 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative" aria-labelledby={headingId} aria-busy={loading}>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="py-1.5">
              {weekdayShort(i)}
            </span>
          ))}
        </div>

        <div className={cn("mt-1 grid grid-cols-7 gap-1 transition-opacity", loading && "opacity-40")}>
          {cells.map((date, i) => {
            if (!date) return <span key={`pad-${i}`} />;
            const info = dayInfo(date);
            const past = date < today || (minNotBeforeDate !== null && date < minNotBeforeDate);
            const available = !past && info?.state === "available";
            const full = !past && info?.state === "full";
            const selected = activeDate === date;
            const label = `${formatDateSrFromKey(date)} ${
              available ? `Dostupno: ${info!.trips.length} ${info!.trips.length === 1 ? "polazak" : "polazaka"}` : full ? "Popunjeno" : "Nema polazaka"
            }`;
            return (
              <button
                key={date}
                type="button"
                disabled={!available}
                onClick={() => pickDate(date)}
                aria-label={label}
                aria-pressed={selected}
                className={cn(
                  "relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200",
                  available &&
                    !selected &&
                    "border border-brand/30 bg-brand/[0.08] text-fg hover:border-brand hover:bg-brand/20",
                  available && selected && "border border-brand bg-brand text-[#0b0b0b] shadow-[0_8px_24px_-10px_rgb(240_120_50/0.8)]",
                  !available && "cursor-not-allowed text-fg/25",
                  full && "bg-white/[0.03] line-through decoration-white/30",
                )}
              >
                {Number(date.slice(8))}
                {available ? (
                  <span
                    aria-hidden="true"
                    className={cn("absolute bottom-1 size-1 rounded-full", selected ? "bg-[#0b0b0b]" : "bg-brand")}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
            <Loader2 className="size-6 animate-spin text-brand" aria-hidden="true" />
            <span className="sr-only">Učitavanje termina…</span>
          </div>
        ) : null}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted" aria-label="Legenda kalendara">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded border border-brand/40 bg-brand/15" aria-hidden="true" /> Slobodni termini
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded bg-white/[0.06]" aria-hidden="true" /> <span className="line-through">Popunjeno</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded border border-line" aria-hidden="true" /> Nema polazaka
        </li>
      </ul>

      {failed ? (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="font-semibold text-danger">Termine trenutno nije moguće učitati.</p>
            <button type="button" onClick={() => setNonce((n) => n + 1)} className="mt-1 font-semibold underline underline-offset-4">
              Pokušaj ponovo
            </button>
          </div>
        </div>
      ) : null}

      {noTripsAtAll ? (
        <p role="status" className="mt-5 rounded-xl border border-line bg-card/60 p-4 text-sm text-muted">
          Za {monthName(cursor.monthIndex).toLowerCase()} trenutno nema dostupnih polazaka na ovoj relaciji.
          Pogledajte sledeći mesec ili nas kontaktirajte za posebnu vožnju.
        </p>
      ) : null}

      {activeDate && activeInfo ? (
        <div className="mt-5" role="group" aria-label={`Polasci za ${formatDateSrFromKey(activeDate)}`}>
          <p className="mb-3 text-sm font-semibold">
            Slobodni polasci — <span className="text-muted">{formatDateSrFromKey(activeDate)}</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeInfo.trips.map((t) => {
              const selected = value?.tripId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({ tripId: t.id, date: activeDate, time: t.time, remaining: t.remaining, unitPrice: t.unitPrice })
                  }
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                    selected
                      ? "border-brand bg-brand/10 shadow-[0_0_0_1px_rgb(240_120_50/0.4)]"
                      : "border-line bg-card/60 hover:border-white/30",
                  )}
                >
                  <span className="flex items-center gap-2.5 text-base font-bold tabular-nums">
                    <Clock className="size-4 text-brand" aria-hidden="true" />
                    {t.time}
                  </span>
                  <span className="flex flex-col items-end text-xs leading-tight text-muted">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" aria-hidden="true" />
                      {t.remaining <= 3 ? `Još ${t.remaining} ${t.remaining === 1 ? "mesto" : "mesta"}` : `${t.remaining} slobodnih mesta`}
                    </span>
                    <span className="mt-0.5 font-semibold text-fg">
                      {formatMoney(t.unitPrice, currency)}
                      {pricingMode === "per_person" ? " / osobi" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : activeDate && !loading && !failed ? (
        <p className="mt-5 text-sm text-muted">Za izabrani datum nema slobodnih polazaka.</p>
      ) : !loading && !failed && !noTripsAtAll ? (
        <p className="mt-5 text-sm text-muted">Izaberite datum označen narandžastom bojom da vidite slobodne polaske.</p>
      ) : null}
    </div>
  );
}

/** ISO instant used to restrict the return calendar to dates after the outbound departure. */
export function returnNotBefore(date: string, time: string, tz: string): string {
  return zonedToUtc(date, time, tz).toISOString();
}
