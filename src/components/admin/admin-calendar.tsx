"use client";

import { useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Repeat, Ticket } from "lucide-react";
import { blockDate, unblockDate } from "@/app/admin/actions/trips";
import {
  CancelTripDialog,
  DuplicateModal,
  RecurringModal,
  TripFormModal,
  type FleetChoice,
  type RouteChoice,
} from "@/components/admin/trip-forms";
import { ViewTabs } from "@/components/admin/trips-manager";
import { Modal, PageHeader, TripStatusBadge, useRunner } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDateSrFromKey, monthName, toZoned, daysInMonth, weekdayLong, weekdayOfKey, weekdayShort } from "@/lib/reservations/time";
import type { BlockedDateRow, TripAvailabilityRow } from "@/lib/reservations/types";

type Props = {
  year: number;
  monthIndex: number;
  monthParam: string;
  route: string;
  trips: TripAvailabilityRow[];
  blocked: BlockedDateRow[];
  routes: RouteChoice[];
  fleet: FleetChoice;
  today: string;
  defaultCapacity: number;
  timezone: string;
  currency: string;
  canManage: boolean;
};

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AdminCalendar(props: Props) {
  const { year, monthIndex, route, trips, blocked, routes, fleet, today, defaultCapacity, timezone, currency, canManage } = props;
  const { run, pending } = useRunner();
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [editing, setEditing] = useState<TripAvailabilityRow | null>(null);
  const [duplicating, setDuplicating] = useState<TripAvailabilityRow | null>(null);
  const [cancelling, setCancelling] = useState<TripAvailabilityRow | null>(null);
  const [recurring, setRecurring] = useState(false);

  const pad = (n: number) => String(n).padStart(2, "0");
  const keyFor = (day: number) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
  const common = { routes, fleet, defaultCapacity, timezone, currency };
  const routeById = new Map(routes.map((r) => [r.id, r]));

  const tripsByDay = new Map<string, TripAvailabilityRow[]>();
  for (const t of trips) {
    const k = toZoned(t.departure_at, timezone).date;
    tripsByDay.set(k, [...(tripsByDay.get(k) ?? []), t]);
  }
  const blockedByDay = new Map<string, BlockedDateRow[]>();
  for (const b of blocked) blockedByDay.set(b.blocked_on, [...(blockedByDay.get(b.blocked_on) ?? []), b]);

  const total = daysInMonth(year, monthIndex);
  const offset = weekdayOfKey(keyFor(1));
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const nav = (m: string) => `/admin/calendar?m=${m}${route ? `&route=${route}` : ""}`;
  const dayTrips = dayKey ? (tripsByDay.get(dayKey) ?? []) : [];
  const dayBlocks = dayKey ? (blockedByDay.get(dayKey) ?? []) : [];
  const wholeDayBlock = dayBlocks.find((b) => b.route_id === null) ?? null;

  return (
    <>
      <PageHeader
        title="Kalendar polazaka"
        description="Pregled po danima. Kliknite na dan za izmenu, dodavanje ili blokiranje."
        actions={
          canManage ? (
            <Button variant="outline" size="sm" onClick={() => setRecurring(true)} disabled={routes.length === 0}>
              <Repeat className="size-4" aria-hidden="true" />
              Ponavljajući polasci
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ViewTabs active="calendar" />
        <form method="get" action="/admin/calendar" className="flex items-center gap-2">
          <input type="hidden" name="m" value={props.monthParam} />
          <label htmlFor="cal-route" className="sr-only">
            Relacija
          </label>
          <Select id="cal-route" name="route" defaultValue={route} className="min-w-52" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            <option value="">Sve relacije</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
          <noscript>
            <Button type="submit" size="sm">
              Primeni
            </Button>
          </noscript>
        </form>
      </div>

      <div className="surface-raised overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-hair px-4 py-3 sm:px-5">
          <ButtonLink href={nav(shiftMonth(year, monthIndex, -1))} variant="ghost" size="sm" aria-label="Prethodni mesec">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </ButtonLink>
          <h2 className="text-base font-bold sm:text-lg" aria-live="polite">
            {monthName(monthIndex)} {year}.
          </h2>
          <div className="flex items-center gap-1">
            <ButtonLink href={nav(today.slice(0, 7))} variant="ghost" size="sm">
              Danas
            </ButtonLink>
            <ButtonLink href={nav(shiftMonth(year, monthIndex, 1))} variant="ghost" size="sm" aria-label="Sledeći mesec">
              <ChevronRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-hair text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="py-2">
              {weekdayShort(i)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-20 border-b border-r border-hair bg-black/20 sm:min-h-28" aria-hidden="true" />;
            const key = keyFor(day);
            const list = tripsByDay.get(key) ?? [];
            const active = list.filter((t) => t.status !== "cancelled");
            const isBlocked = blockedByDay.has(key);
            const isToday = key === today;
            const isPast = key < today;
            const seats = active.reduce((s, t) => s + t.booked, 0);
            const cap = active.reduce((s, t) => s + t.capacity, 0);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDayKey(key)}
                aria-label={`${formatDateSrFromKey(key)}: ${active.length} polazaka${isBlocked ? ", blokiran" : ""}`}
                className={`group flex min-h-20 flex-col items-stretch gap-1 border-b border-r border-hair p-1.5 text-left align-top transition-colors hover:bg-white/[0.05] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:min-h-28 sm:p-2 ${
                  isPast ? "bg-black/10 text-muted" : ""
                } ${isBlocked ? "bg-danger/[0.08]" : ""}`}
              >
                <span className="flex items-center justify-between">
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${isToday ? "bg-brand text-[#0b0b0b]" : ""}`}>{day}</span>
                  {isBlocked ? <Ban className="size-3.5 text-danger" aria-hidden="true" /> : null}
                </span>
                {/* Compact on phones: a single summary pill */}
                {active.length > 0 ? (
                  <span className="rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand sm:hidden">
                    {active.length} • {seats}/{cap}
                  </span>
                ) : null}
                <span className="hidden flex-col gap-1 sm:flex">
                  {list.slice(0, 3).map((t) => {
                    const full = t.status === "full" || t.remaining <= 0;
                    return (
                      <span
                        key={t.id}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                          t.status === "cancelled"
                            ? "bg-white/5 text-muted line-through"
                            : full
                              ? "bg-danger/15 text-danger"
                              : "bg-brand/15 text-brand"
                        }`}
                      >
                        {toZoned(t.departure_at, timezone).time} · {t.booked}/{t.capacity}
                      </span>
                    );
                  })}
                  {list.length > 3 ? <span className="px-1 text-[11px] text-muted">+{list.length - 3} još</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted" aria-label="Legenda">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded bg-brand/30" aria-hidden="true" /> Ima mesta
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded bg-danger/30" aria-hidden="true" /> Popunjeno
        </li>
        <li className="flex items-center gap-2">
          <Ban className="size-3 text-danger" aria-hidden="true" /> Blokiran datum
        </li>
      </ul>

      {/* Day detail */}
      <Modal
        open={Boolean(dayKey)}
        onClose={() => setDayKey(null)}
        title={dayKey ? `${weekdayLong(weekdayOfKey(dayKey))}, ${formatDateSrFromKey(dayKey)}` : ""}
        size="lg"
      >
        {dayKey ? (
          <div className="space-y-5">
            {dayBlocks.length > 0 ? (
              <ul className="space-y-2">
                {dayBlocks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
                    <span>
                      <span className="flex items-center gap-2 font-semibold text-danger">
                        <Ban className="size-4" aria-hidden="true" />
                        Blokirano · {b.route_id ? (routeById.get(b.route_id)?.label ?? "relacija") : "sve relacije"}
                      </span>
                      {b.reason ? <span className="mt-0.5 block text-xs text-muted">{b.reason}</span> : null}
                    </span>
                    {canManage ? (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => unblockDate(b.id))}>
                        Odblokiraj
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {dayTrips.length === 0 ? (
              <p className="text-sm text-muted">Nema polazaka na ovaj dan.</p>
            ) : (
              <ul className="space-y-3">
                {dayTrips.map((t) => {
                  const cancelled = t.status === "cancelled";
                  return (
                    <li key={t.id} className={`rounded-xl border border-line p-4 ${cancelled ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold">{toZoned(t.departure_at, timezone).time}</p>
                          <p className="text-sm text-muted">{routeById.get(t.route_id)?.label ?? "Relacija"}</p>
                        </div>
                        <div className="text-right text-sm">
                          <TripStatusBadge status={t.status} />
                          <p className="mt-1 tabular-nums text-muted">
                            {t.booked}/{t.capacity} · slobodno {cancelled ? 0 : t.remaining}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <ButtonLink href={`/admin/bookings?trip=${t.id}`} variant="outline" size="sm">
                          <Ticket className="size-4" aria-hidden="true" />
                          Rezervacije
                        </ButtonLink>
                        {canManage && !cancelled ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => { setDayKey(null); setEditing(t); }}>
                              <Pencil className="size-4" aria-hidden="true" />
                              Izmeni
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setDayKey(null); setDuplicating(t); }}>
                              <Copy className="size-4" aria-hidden="true" />
                              Dupliraj
                            </Button>
                            <Button variant="outline" size="sm" className="text-danger" onClick={() => { setDayKey(null); setCancelling(t); }}>
                              <Ban className="size-4" aria-hidden="true" />
                              Otkaži
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {canManage ? (
              <div className="flex flex-wrap gap-2 border-t border-hair pt-5">
                {dayKey >= today ? (
                  <Button size="sm" onClick={() => { setCreatingOn(dayKey); setDayKey(null); }} disabled={routes.length === 0}>
                    <Plus className="size-4" aria-hidden="true" />
                    Dodaj polazak
                  </Button>
                ) : null}
                {dayKey >= today && !wholeDayBlock ? (
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => blockDate(dayKey, route || null, ""))}>
                    <Ban className="size-4" aria-hidden="true" />
                    Blokiraj {route ? "ovu relaciju" : "dan"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <TripFormModal open={Boolean(creatingOn)} onClose={() => setCreatingOn(null)} defaultDate={creatingOn ?? today} defaultRouteId={route || undefined} {...common} />
      <TripFormModal open={Boolean(editing)} onClose={() => setEditing(null)} trip={editing} {...common} />
      <RecurringModal open={recurring} onClose={() => setRecurring(false)} defaultDate={today} {...common} />
      <DuplicateModal trip={duplicating} onClose={() => setDuplicating(null)} timezone={timezone} />
      <CancelTripDialog trip={cancelling} onClose={() => setCancelling(null)} timezone={timezone} />
    </>
  );
}