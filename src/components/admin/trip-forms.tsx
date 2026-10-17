"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  cancelTrip,
  createRecurringTrips,
  createTrip,
  duplicateTrip,
  updateTrip,
  type AffectedBooking,
} from "@/app/admin/actions/trips";
import { ConfirmDialog, Field, Modal, Switch, useRunner, useToast } from "@/components/admin/ui";
import { ButtonLink, Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WhatsAppIcon } from "@/components/icons";
import { formatMoney } from "@/lib/reservations/pricing";
import { addDaysToKey, formatDateTimeSr, toZoned, weekdayOfKey, weekdayShort } from "@/lib/reservations/time";
import type { TripAvailabilityRow } from "@/lib/reservations/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export type RouteChoice = { id: string; label: string; pricingMode: "per_person" | "per_vehicle"; basePrice: number; isActive: boolean };
export type FleetChoice = { vehicles: { id: string; name: string; capacity: number }[]; drivers: { id: string; name: string }[] };

type CommonProps = {
  routes: RouteChoice[];
  fleet: FleetChoice;
  defaultCapacity: number;
  timezone: string;
  currency: string;
};

// ---------------------------------------------------------------------------
//  Create / edit a single trip
// ---------------------------------------------------------------------------
export function TripFormModal({
  open,
  onClose,
  trip,
  defaultDate,
  defaultRouteId,
  ...common
}: CommonProps & {
  open: boolean;
  onClose: () => void;
  trip?: TripAvailabilityRow | null;
  defaultDate?: string;
  defaultRouteId?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={trip ? "Izmeni polazak" : "Novi polazak"}
      description={trip ? undefined : "Polazak postaje vidljiv na stranici za rezervaciju čim ga sačuvate."}
      size="lg"
    >
      {open ? <TripForm key={trip?.id ?? `new-${defaultDate}-${defaultRouteId}`} trip={trip ?? null} defaultDate={defaultDate} defaultRouteId={defaultRouteId} onDone={onClose} {...common} /> : null}
    </Modal>
  );
}

function TripForm({
  trip,
  defaultDate,
  defaultRouteId,
  onDone,
  routes,
  fleet,
  defaultCapacity,
  timezone,
  currency,
}: CommonProps & { trip: TripAvailabilityRow | null; defaultDate?: string; defaultRouteId?: string; onDone: () => void }) {
  const { run, pending } = useRunner();
  const start = trip ? toZoned(trip.departure_at, timezone) : null;
  const arrival = trip?.arrival_at ? toZoned(trip.arrival_at, timezone).time : "";

  const [routeId, setRouteId] = useState(trip?.route_id ?? defaultRouteId ?? routes.find((r) => r.isActive)?.id ?? "");
  const [date, setDate] = useState(start?.date ?? defaultDate ?? "");
  const [time, setTime] = useState(start?.time ?? "08:00");
  const [arrivalTime, setArrivalTime] = useState(arrival);
  const [capacity, setCapacity] = useState(String(trip?.capacity ?? defaultCapacity));
  const [price, setPrice] = useState(trip?.price_override !== null && trip?.price_override !== undefined ? String(trip.price_override) : "");
  const [vehicleId, setVehicleId] = useState(trip?.vehicle_id ?? "");
  const [driverId, setDriverId] = useState(trip?.driver_id ?? "");
  const [full, setFull] = useState(trip?.status === "full");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [askAck, setAskAck] = useState(false);

  const route = routes.find((r) => r.id === routeId);
  const timeMoved = Boolean(trip && start && (start.date !== date || start.time !== time));
  const booked = trip?.booked ?? 0;

  const payload = () => ({
    routeId,
    date,
    time,
    arrivalTime,
    capacity: Number(capacity),
    priceOverride: price.trim() === "" ? null : Number(price),
    vehicleId: vehicleId || null,
    driverId: driverId || null,
    notes,
    status: (full ? "full" : "scheduled") as "full" | "scheduled",
  });

  const save = (ack: boolean) => {
    if (trip) {
      run(() => updateTrip({ ...payload(), id: trip.id }, ack), { onSuccess: onDone });
    } else {
      run(() => createTrip(payload()), { onSuccess: onDone });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trip && timeMoved && booked > 0) setAskAck(true);
        else save(false);
      }}
      className="space-y-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Relacija" htmlFor="t-route" required className="sm:col-span-2">
          <Select id="t-route" value={routeId} onChange={(e) => setRouteId(e.target.value)} disabled={Boolean(trip)} required>
            <option value="" disabled>
              Izaberite relaciju
            </option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.isActive ? "" : " (neaktivna)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Datum polaska" htmlFor="t-date" required>
          <Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Vreme polaska" htmlFor="t-time" required>
          <Input id="t-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label="Vreme dolaska (opciono)" htmlFor="t-arrival">
          <Input id="t-arrival" type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
        </Field>
        <Field
          label="Kapacitet (broj mesta)"
          htmlFor="t-capacity"
          required
          hint={booked > 0 ? `Već rezervisano: ${booked}. Kapacitet ne može biti manji od toga.` : undefined}
        >
          <Input id="t-capacity" type="number" min={Math.max(1, booked)} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
        </Field>
        <Field
          label={`Posebna cena (${currency})`}
          htmlFor="t-price"
          hint={
            route
              ? `Prazno = cena relacije (${formatMoney(route.basePrice, currency)}${route.pricingMode === "per_person" ? " po osobi" : ", privatno vozilo"}).`
              : "Prazno = cena relacije."
          }
        >
          <Input id="t-price" type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Vozilo (opciono)" htmlFor="t-vehicle">
          <Select
            id="t-vehicle"
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              const v = fleet.vehicles.find((x) => x.id === e.target.value);
              if (v && !trip) setCapacity(String(v.capacity));
            }}
          >
            <option value="">Nije dodeljeno</option>
            {fleet.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.capacity} mesta)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vozač (opciono)" htmlFor="t-driver">
          <Select id="t-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Nije dodeljen</option>
            {fleet.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Switch
            id="t-full"
            checked={full}
            onChange={setFull}
            label="Označi kao popunjeno"
            description="Polazak ostaje vidljiv u sistemu, ali se više ne može rezervisati."
          />
        </div>
        <Field label="Opis na kartici (vidi se na sajtu)" htmlFor="t-notes" className="sm:col-span-2">
          <Textarea
            id="t-notes"
            rows={2}
            maxLength={500}
            placeholder="npr. Preuzimanje ispred terminala, klima, mesto za prtljag…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      {timeMoved && booked > 0 ? (
        <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Ovaj polazak ima {booked} rezervisanih mesta. Promena termina menja vreme polaska u tim rezervacijama — obavezno obavestite putnike.
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-hair pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Odustani
        </Button>
        <Button type="submit" size="sm" disabled={pending || !routeId}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {trip ? "Sačuvaj izmene" : "Kreiraj polazak"}
        </Button>
      </div>

      <ConfirmDialog
        open={askAck}
        onClose={() => setAskAck(false)}
        title="Promeniti termin sa rezervacijama?"
        description={`Na ovom polasku ima ${booked} rezervisanih mesta. Vreme polaska u tim rezervacijama biće ažurirano, a putnike morate sami da obavestite.`}
        confirmLabel="Da, promeni termin"
        tone="default"
        pending={pending}
        onConfirm={() => {
          setAskAck(false);
          save(true);
        }}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Recurring trips
// ---------------------------------------------------------------------------
export function RecurringModal({ open, onClose, defaultDate, ...common }: CommonProps & { open: boolean; onClose: () => void; defaultDate: string }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ponavljajući polasci"
      description="Kreirajte raspored za izabrane dane u nedelji. Polasci koji već postoje se preskaču — duplikata nema."
      size="lg"
    >
      {open ? <RecurringForm defaultDate={defaultDate} onDone={onClose} {...common} /> : null}
    </Modal>
  );
}

function RecurringForm({ defaultDate, onDone, routes, fleet, defaultCapacity, currency }: CommonProps & { defaultDate: string; onDone: () => void }) {
  const { run, pending } = useRunner();
  const [routeId, setRouteId] = useState(routes.find((r) => r.isActive)?.id ?? "");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(addDaysToKey(defaultDate, 30));
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [capacity, setCapacity] = useState(String(defaultCapacity));
  const [price, setPrice] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [notes, setNotes] = useState("");

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  let days = 0;
  if (startDate && endDate && endDate >= startDate && weekdays.length) {
    let key = startDate;
    for (let guard = 0; key <= endDate && guard < 800; guard++, key = addDaysToKey(key, 1)) {
      if (weekdays.includes(weekdayOfKey(key))) days++;
    }
  }
  const estimate = days * new Set(times).size;

  const submit = () =>
    run(
      () =>
        createRecurringTrips({
          routeId,
          startDate,
          endDate,
          weekdays,
          times: times.filter(Boolean),
          capacity: Number(capacity),
          priceOverride: price.trim() === "" ? null : Number(price),
          vehicleId: vehicleId || null,
          driverId: driverId || null,
          notes,
          arrivalOffsetMinutes: durationHours.trim() === "" ? null : Math.round(Number(durationHours) * 60),
        }),
      { onSuccess: onDone },
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Relacija" htmlFor="r-route" required className="sm:col-span-2">
          <Select id="r-route" value={routeId} onChange={(e) => setRouteId(e.target.value)} required>
            <option value="" disabled>
              Izaberite relaciju
            </option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.isActive ? "" : " (neaktivna)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Početni datum" htmlFor="r-start" required>
          <Input id="r-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="Krajnji datum" htmlFor="r-end" required>
          <Input id="r-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">
            Dani u nedelji <span className="text-brand">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, d) => (
              <label
                key={d}
                className={`flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                  weekdays.includes(d) ? "border-brand bg-brand text-[#0b0b0b]" : "border-line text-fg hover:border-white/30"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={weekdays.includes(d)} onChange={() => toggleDay(d)} />
                {weekdayShort(d)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">
            Vremena polaska <span className="text-brand">*</span>
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  type="time"
                  aria-label={`Vreme polaska ${i + 1}`}
                  value={t}
                  onChange={(e) => setTimes((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                  className="w-32"
                  required
                />
                {times.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Ukloni vreme"
                    onClick={() => setTimes((all) => all.filter((_, j) => j !== i))}
                    className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/[0.08] hover:text-fg"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
            {times.length < 8 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setTimes((all) => [...all, "12:00"])}>
                <Plus className="size-4" aria-hidden="true" />
                Dodaj vreme
              </Button>
            ) : null}
          </div>
        </fieldset>

        <Field label="Kapacitet (broj mesta)" htmlFor="r-capacity" required>
          <Input id="r-capacity" type="number" min={1} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
        </Field>
        <Field label={`Posebna cena (${currency}, opciono)`} htmlFor="r-price" hint="Prazno = cena relacije.">
          <Input id="r-price" type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Trajanje vožnje u satima (opciono)" htmlFor="r-duration" hint="Koristi se za vreme dolaska.">
          <Input id="r-duration" type="number" min={0} max={24} step="0.25" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
        </Field>
        <Field label="Vozilo (opciono)" htmlFor="r-vehicle">
          <Select
            id="r-vehicle"
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              const v = fleet.vehicles.find((x) => x.id === e.target.value);
              if (v) setCapacity(String(v.capacity));
            }}
          >
            <option value="">Nije dodeljeno</option>
            {fleet.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.capacity} mesta)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vozač (opciono)" htmlFor="r-driver">
          <Select id="r-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Nije dodeljen</option>
            {fleet.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Opis na kartici (vidi se na sajtu)" htmlFor="r-notes">
          <Input
            id="r-notes"
            maxLength={500}
            placeholder="npr. Preuzimanje ispred terminala"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <p role="status" className="rounded-xl border border-line bg-field/50 p-3 text-sm">
        {estimate > 0 ? (
          <>
            Biće kreirano do <strong>{estimate}</strong> polazaka ({days} {days === 1 ? "dan" : "dana"} × {new Set(times).size} {new Set(times).size === 1 ? "vreme" : "vremena"}).
            Prošli datumi, blokirani dani i polasci koji već postoje se preskaču.
          </>
        ) : (
          "Izaberite period, dane u nedelji i vreme polaska."
        )}
      </p>

      <div className="flex flex-col-reverse gap-2 border-t border-hair pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Odustani
        </Button>
        <Button type="submit" size="sm" disabled={pending || !routeId || estimate === 0 || estimate > 400}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Kreiraj raspored
        </Button>
      </div>
      {estimate > 400 ? <p className="text-sm text-danger">Previše polazaka odjednom (najviše 400). Skratite period.</p> : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Duplicate to other dates
// ---------------------------------------------------------------------------
export function DuplicateModal({ trip, onClose, timezone }: { trip: TripAvailabilityRow | null; onClose: () => void; timezone: string }) {
  return (
    <Modal
      open={Boolean(trip)}
      onClose={onClose}
      title="Dupliraj polazak"
      description={trip ? `Isto vreme (${toZoned(trip.departure_at, timezone).time}), kapacitet, cena i vozilo na izabranim datumima.` : undefined}
      size="md"
    >
      {trip ? <DuplicateForm key={trip.id} trip={trip} timezone={timezone} onDone={onClose} /> : null}
    </Modal>
  );
}

function DuplicateForm({ trip, timezone, onDone }: { trip: TripAvailabilityRow; timezone: string; onDone: () => void }) {
  const { run, pending } = useRunner();
  const toast = useToast();
  const [dates, setDates] = useState<string[]>([]);
  const [input, setInput] = useState(addDaysToKey(toZoned(trip.departure_at, timezone).date, 7));

  const add = () => {
    if (!input) return;
    if (dates.includes(input)) return toast.info("Taj datum je već dodat.");
    setDates((d) => [...d, input].sort());
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2">
        <Field label="Datum" htmlFor="dup-date" className="flex-1">
          <Input id="dup-date" type="date" value={input} onChange={(e) => setInput(e.target.value)} />
        </Field>
        <Button type="button" variant="outline" size="md" onClick={add}>
          <Plus className="size-4" aria-hidden="true" />
          Dodaj
        </Button>
      </div>
      {dates.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Izabrani datumi">
          {dates.map((d) => (
            <li key={d} className="flex items-center gap-1.5 rounded-full border border-line bg-field px-3 py-1.5 text-sm">
              {d.split("-").reverse().join(".")}.
              <button type="button" aria-label={`Ukloni ${d}`} onClick={() => setDates((all) => all.filter((x) => x !== d))} className="text-muted hover:text-fg">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Dodajte jedan ili više datuma.</p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-hair pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Odustani
        </Button>
        <Button type="button" size="sm" disabled={pending || dates.length === 0} onClick={() => run(() => duplicateTrip(trip.id, dates), { onSuccess: onDone })}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Dupliraj ({dates.length})
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Cancel a trip (and tell the admin who must be informed)
// ---------------------------------------------------------------------------
export function CancelTripDialog({ trip, onClose, timezone }: { trip: TripAvailabilityRow | null; onClose: () => void; timezone: string }) {
  const { run, pending } = useRunner();
  const [cancelBookings, setCancelBookings] = useState(true);
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);
  const booked = trip?.booked ?? 0;

  const close = () => {
    setAffected(null);
    setCancelBookings(true);
    onClose();
  };

  if (affected && trip) {
    return (
      <Modal open onClose={close} title="Polazak je otkazan" description="Obavestite putnike koji nemaju e-adresu (ili sve putem WhatsApp-a):" size="md" footer={<Button type="button" size="sm" onClick={close}>Zatvori</Button>}>
        {affected.length === 0 ? (
          <p className="text-sm text-muted">Na ovom polasku nije bilo aktivnih rezervacija.</p>
        ) : (
          <ul className="space-y-2">
            {affected.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                <span>
                  <span className="block font-semibold">
                    {b.reference} · {b.name}
                  </span>
                  <span className="text-xs text-muted">{b.phone}</span>
                </span>
                <ButtonLink
                  size="sm"
                  variant="whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={buildWhatsAppUrl(
                    `Poštovani ${b.name}, nažalost polazak ${formatDateTimeSr(b.departure, timezone)} (rezervacija ${b.reference}) je otkazan. Slobodno nas kontaktirajte za novi termin.`,
                    b.phone.replace(/\D/g, ""),
                  )}
                >
                  <WhatsAppIcon className="size-4" />
                  Obavesti
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    );
  }

  return (
    <ConfirmDialog
      open={Boolean(trip)}
      onClose={close}
      title="Otkazati polazak?"
      description={
        trip ? (
          <>
            Polazak <strong className="text-fg">{formatDateTimeSr(trip.departure_at, timezone)}</strong> više neće biti dostupan za rezervaciju.
            {booked > 0 ? <> Na njemu je <strong className="text-fg">{booked}</strong> rezervisanih mesta.</> : null}
          </>
        ) : null
      }
      confirmLabel="Otkaži polazak"
      reasonLabel="Razlog (opciono)"
      pending={pending}
      onConfirm={(reason) =>
        trip &&
        run(() => cancelTrip(trip.id, reason, cancelBookings), {
          onSuccess: (data) => setAffected(data.affected),
        })
      }
    >
      {booked > 0 ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-fg">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--color-brand)]" checked={cancelBookings} onChange={(e) => setCancelBookings(e.target.checked)} />
          <span>
            <span className="block text-sm font-semibold">Otkaži i sve rezervacije na ovom polasku</span>
            <span className="text-xs text-muted">
              Ako ne označite, rezervacije ostaju aktivne i morate ih ručno rešiti. Nakon otkazivanja dobijate listu putnika za obaveštavanje.
            </span>
          </span>
        </label>
      ) : null}
    </ConfirmDialog>
  );
}
