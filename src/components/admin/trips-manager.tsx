"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, CalendarClock, CalendarRange, Copy, Filter, Pencil, Plus, Repeat, Ticket, Trash2, X } from "lucide-react";
import { blockDate, setTripFull, unblockDate } from "@/app/admin/actions/trips";
import {
  CancelTripDialog,
  DuplicateModal,
  RecurringModal,
  TripFormModal,
  type FleetChoice,
  type RouteChoice,
} from "@/components/admin/trip-forms";
import { Card, EmptyState, Field, PageHeader, TripStatusBadge, useRunner } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/reservations/pricing";
import { formatDateSrFromKey, formatDateTimeSr, toZoned, weekdayLong, weekdayOfKey } from "@/lib/reservations/time";
import { TRIP_STATUS_LABELS, type BlockedDateRow, type TripAvailabilityRow } from "@/lib/reservations/types";

type Filters = { route: string; status: string; from: string; to: string };

export type TripsManagerProps = {
  trips: TripAvailabilityRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: Filters;
  routes: RouteChoice[];
  fleet: FleetChoice;
  blocked: BlockedDateRow[];
  today: string;
  defaultCapacity: number;
  timezone: string;
  currency: string;
  canManage: boolean;
};

function query(filters: Partial<Filters>, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function ViewTabs({ active }: { active: "list" | "calendar" }) {
  const base = "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors";
  return (
    <nav aria-label="Prikaz" className="inline-flex gap-1 rounded-xl border border-line bg-field/60 p-1">
      <Link href="/admin/trips" aria-current={active === "list" ? "page" : undefined} className={`${base} ${active === "list" ? "bg-brand text-[#0b0b0b]" : "text-muted hover:text-fg"}`}>
        <CalendarClock className="size-4" aria-hidden="true" />
        Lista
      </Link>
      <Link href="/admin/calendar" aria-current={active === "calendar" ? "page" : undefined} className={`${base} ${active === "calendar" ? "bg-brand text-[#0b0b0b]" : "text-muted hover:text-fg"}`}>
        <CalendarRange className="size-4" aria-hidden="true" />
        Kalendar
      </Link>
    </nav>
  );
}

export function TripsManager(props: TripsManagerProps) {
  const { trips, total, page, pageSize, filters, routes, fleet, blocked, today, defaultCapacity, timezone, currency, canManage } = props;
  const { run, pending } = useRunner();
  const [editing, setEditing] = useState<TripAvailabilityRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [duplicating, setDuplicating] = useState<TripAvailabilityRow | null>(null);
  const [cancelling, setCancelling] = useState<TripAvailabilityRow | null>(null);

  const routeById = new Map(routes.map((r) => [r.id, r]));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const common = { routes, fleet, defaultCapacity, timezone, currency };
  const hasFilters = Boolean(filters.route || filters.status || filters.to || filters.from !== today);

  return (
    <>
      <PageHeader
        title="Polasci"
        description="Termini koje putnici mogu da rezervišu. Samo ovde kreirani polasci pojavljuju se na stranici za rezervaciju."
        actions={
          canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setRecurring(true)} disabled={routes.length === 0}>
                <Repeat className="size-4" aria-hidden="true" />
                Ponavljajući
              </Button>
              <Button size="sm" onClick={() => setCreating(true)} disabled={routes.length === 0}>
                <Plus className="size-4" aria-hidden="true" />
                Novi polazak
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-5">
        <ViewTabs active="list" />
      </div>

      {routes.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" aria-hidden="true" />}
          title="Prvo napravite relaciju"
          description="Polasci se vezuju za relaciju (polazište → odredište) sa cenom."
          action={
            <ButtonLink href="/admin/routes" size="sm">
              Idi na relacije
            </ButtonLink>
          }
        />
      ) : (
        <>
          <Card className="mb-6 p-4 sm:p-5">
            <form method="get" action="/admin/trips" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="tf-route" className="sr-only">
                  Relacija
                </label>
                <Select id="tf-route" name="route" defaultValue={filters.route}>
                  <option value="">Sve relacije</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="tf-status" className="sr-only">
                  Status
                </label>
                <Select id="tf-status" name="status" defaultValue={filters.status}>
                  <option value="">Svi statusi</option>
                  {Object.entries(TRIP_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="tf-from" className="sr-only">
                  Od datuma
                </label>
                <Input id="tf-from" name="from" type="date" defaultValue={filters.from} title="Od datuma" />
              </div>
              <div>
                <label htmlFor="tf-to" className="sr-only">
                  Do datuma
                </label>
                <Input id="tf-to" name="to" type="date" defaultValue={filters.to} title="Do datuma" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  <Filter className="size-4" aria-hidden="true" />
                  Primeni
                </Button>
                {hasFilters ? (
                  <ButtonLink href="/admin/trips" variant="ghost" size="sm">
                    <X className="size-4" aria-hidden="true" />
                    Poništi
                  </ButtonLink>
                ) : null}
              </div>
            </form>
          </Card>

          {trips.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-5" aria-hidden="true" />}
              title={hasFilters ? "Nema polazaka za izabrane filtere" : "Nema zakazanih polazaka"}
              description={
                hasFilters
                  ? "Promenite filtere ili prikažite i prošle datume."
                  : "Dok ne kreirate polazak, putnici ne mogu da rezervišu. Dodajte pojedinačni polazak ili napravite ponavljajući raspored."
              }
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {total} polazaka · strana {page} od {pages}
              </p>

              <ul className="space-y-3">
                {trips.map((t) => {
                  const route = routeById.get(t.route_id);
                  const z = toZoned(t.departure_at, timezone);
                  const pct = t.capacity > 0 ? Math.min(100, Math.round((t.booked / t.capacity) * 100)) : 0;
                  const cancelled = t.status === "cancelled";
                  const price = t.price_override ?? route?.basePrice;
                  return (
                    <li key={t.id} className={`surface-raised rounded-2xl p-4 sm:p-5 ${cancelled ? "opacity-60" : ""}`}>
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wider text-muted">
                            {weekdayLong(z.weekday)}
                          </p>
                          <p className="text-lg font-bold">{formatDateTimeSr(t.departure_at, timezone)}</p>
                          <p className="truncate text-sm text-muted">{route?.label ?? "Nepoznata relacija"}</p>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-baseline justify-between text-sm">
                            <span className="font-semibold tabular-nums">
                              {t.booked} / {t.capacity} mesta
                            </span>
                            <span className="text-xs text-muted">{cancelled ? "—" : `slobodno ${t.remaining}`}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Popunjenost">
                            <div className={`h-full rounded-full ${pct >= 100 ? "bg-danger" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <TripStatusBadge status={t.status} />
                          {price !== undefined ? (
                            <span className="text-muted">
                              {formatMoney(Number(price), currency)}
                              {t.price_override !== null ? " (posebna)" : ""}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-1.5 lg:justify-end">
                          <ButtonLink href={`/admin/bookings?trip=${t.id}`} variant="outline" size="sm" aria-label="Rezervacije na ovom polasku">
                            <Ticket className="size-4" aria-hidden="true" />
                            <span className="lg:sr-only">Rezervacije</span>
                          </ButtonLink>
                          {canManage && !cancelled ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setEditing(t)} aria-label="Izmeni polazak">
                                <Pencil className="size-4" aria-hidden="true" />
                                <span className="lg:sr-only">Izmeni</span>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDuplicating(t)} aria-label="Dupliraj polazak">
                                <Copy className="size-4" aria-hidden="true" />
                                <span className="lg:sr-only">Dupliraj</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pending}
                                onClick={() => run(() => setTripFull(t.id, t.status !== "full"))}
                              >
                                {t.status === "full" ? "Otvori" : "Popunjeno"}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setCancelling(t)} aria-label="Otkaži polazak" className="text-danger">
                                <Ban className="size-4" aria-hidden="true" />
                                <span className="lg:sr-only">Otkaži</span>
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {cancelled && t.cancel_reason ? <p className="mt-3 text-xs text-muted">Razlog otkazivanja: {t.cancel_reason}</p> : null}
                    </li>
                  );
                })}
              </ul>

              {pages > 1 ? (
                <nav aria-label="Stranice" className="mt-6 flex items-center justify-between">
                  <ButtonLink href={`/admin/trips${query(filters, { page: String(page - 1) })}`} variant="outline" size="sm" aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
                    Prethodna
                  </ButtonLink>
                  <span className="text-sm text-muted tabular-nums">
                    {page} / {pages}
                  </span>
                  <ButtonLink href={`/admin/trips${query(filters, { page: String(page + 1) })}`} variant="outline" size="sm" aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
                    Sledeća
                  </ButtonLink>
                </nav>
              ) : null}
            </>
          )}
        </>
      )}

      <BlockedDatesPanel blocked={blocked} routes={routes} today={today} canManage={canManage} />

      <TripFormModal open={creating} onClose={() => setCreating(false)} defaultDate={today} {...common} />
      <TripFormModal open={Boolean(editing)} onClose={() => setEditing(null)} trip={editing} {...common} />
      <RecurringModal open={recurring} onClose={() => setRecurring(false)} defaultDate={today} {...common} />
      <DuplicateModal trip={duplicating} onClose={() => setDuplicating(null)} timezone={timezone} />
      <CancelTripDialog trip={cancelling} onClose={() => setCancelling(null)} timezone={timezone} />
    </>
  );
}

// ---------------------------------------------------------------------------
//  Blocked dates
// ---------------------------------------------------------------------------
export function BlockedDatesPanel({ blocked, routes, today, canManage }: { blocked: BlockedDateRow[]; routes: RouteChoice[]; today: string; canManage: boolean }) {
  const { run, pending } = useRunner();
  const [date, setDate] = useState(today);
  const [routeId, setRouteId] = useState("");
  const [reason, setReason] = useState("");
  const routeLabel = new Map(routes.map((r) => [r.id, r.label]));

  return (
    <section aria-labelledby="blocked-title" className="mt-10">
      <h2 id="blocked-title" className="mb-1 text-lg font-bold">
        Blokirani datumi
      </h2>
      <p className="mb-4 text-sm text-muted">Na blokirane datume putnici ne mogu da rezervišu, čak ni ako postoji polazak.</p>

      {canManage ? (
        <Card className="mb-4 p-4 sm:p-5">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_1fr_auto] lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => blockDate(date, routeId || null, reason), { onSuccess: () => setReason("") });
            }}
          >
            <Field label="Datum" htmlFor="b-date">
              <Input id="b-date" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Relacija" htmlFor="b-route">
              <Select id="b-route" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                <option value="">Sve relacije</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Razlog (opciono)" htmlFor="b-reason">
              <Input id="b-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="npr. Praznik" />
            </Field>
            <Button type="submit" size="md" disabled={pending || !date}>
              <Ban className="size-4" aria-hidden="true" />
              Blokiraj
            </Button>
          </form>
        </Card>
      ) : null}

      {blocked.length === 0 ? (
        <p className="text-sm text-muted">Nema blokiranih datuma.</p>
      ) : (
        <ul className="divide-y divide-hair overflow-hidden rounded-2xl border border-line">
          {blocked.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold">
                  {formatDateSrFromKey(b.blocked_on)} · {weekdayLong(weekdayOfKey(b.blocked_on))}
                </span>
                <span className="block truncate text-xs text-muted">
                  {b.route_id ? (routeLabel.get(b.route_id) ?? "Relacija") : "Sve relacije"}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
              </span>
              {canManage ? (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => unblockDate(b.id))} aria-label={`Ukloni blokadu ${b.blocked_on}`}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Ukloni
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
