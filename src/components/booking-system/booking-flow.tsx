"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Info,
  Loader2,
  Luggage,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, Stepper } from "@/components/booking-system/booking-fields";
import { TripPicker, returnNotBefore, type PickedTrip } from "@/components/booking-system/trip-picker";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/uuid";
import type { BookingOptions } from "@/lib/reservations/public-data";
import { formatMoney } from "@/lib/reservations/pricing";
import { DIAL_CODES, composePhone } from "@/lib/reservations/phone-codes";
import { EMAIL_RE, normalizePhone } from "@/lib/reservations/validation";
import { formatDateSrFromKey } from "@/lib/reservations/time";
import type { QuoteLine } from "@/lib/reservations/types";

type QuoteState =
  | { key: string; ok: true; total: number; lines: QuoteLine[]; confirmationMode: "auto" | "manual" }
  | { key: string; ok: false; message: string };

type FieldErrors = Partial<Record<"route" | "trip" | "return" | "name" | "phone" | "email" | "notes", string>>;

const TRIP_ERRORS = new Set([
  "TRIP_NOT_FOUND", "TRIP_CANCELLED", "TRIP_FULL", "NOT_ENOUGH_SEATS", "TOO_SOON", "TOO_FAR", "DATE_BLOCKED",
  "ROUTE_INACTIVE", "INVALID_RETURN_TRIP", "RETURN_BEFORE_DEPARTURE",
]);

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-raised rounded-2xl p-5 sm:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-muted">
          <span className="tabular-nums text-brand">{step}</span>
          <span aria-hidden="true" className="h-px w-8 bg-white/20" />
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function BookingFlow({ options }: { options: BookingOptions }) {
  const router = useRouter();
  const { settings, locations, routes } = options;
  const tz = settings.timezone;
  const currency = settings.currency;

  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [tripType, setTripType] = useState<"one_way" | "return">("one_way");
  const [outbound, setOutbound] = useState<PickedTrip | null>(null);
  const [returnPick, setReturnPick] = useState<PickedTrip | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(0);
  const [name, setName] = useState("");
  const [dial, setDial] = useState("+381");
  const [nationalPhone, setNationalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [idempotencyKey] = useState(() => uuid());

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quoteState, setQuoteState] = useState<QuoteState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const origins = useMemo(
    () => locations.filter((l) => routes.some((r) => r.origin_id === l.id)),
    [locations, routes],
  );
  const destinations = useMemo(
    () =>
      routes
        .filter((r) => r.origin_id === originId)
        .map((r) => locationById.get(r.destination_id))
        .filter((l): l is NonNullable<typeof l> => Boolean(l)),
    [routes, originId, locationById],
  );
  const route = routes.find((r) => r.origin_id === originId && r.destination_id === destinationId) ?? null;
  const wantsReturn = tripType === "return" && Boolean(route?.has_return);

  // Seats: never offer more passengers than the tightest selected departure can take.
  const seatCap = Math.max(
    1,
    Math.min(outbound?.remaining ?? 60, wantsReturn ? (returnPick?.remaining ?? 60) : 60, 60),
  );
  const pax = Math.min(passengers, seatCap);

  const resetTrips = () => {
    setOutbound(null);
    setReturnPick(null);
    setQuoteState(null);
    setPriceNotice(false);
  };

  const needsReturn = wantsReturn;
  const quoteKey =
    outbound && (!needsReturn || returnPick)
      ? `${outbound.tripId}|${needsReturn ? returnPick?.tripId : ""}|${pax}`
      : null;

  useEffect(() => {
    if (!quoteKey || !outbound) return;
    const controller = new AbortController();
    fetch("/api/booking/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: outbound.tripId,
        returnTripId: needsReturn ? returnPick?.tripId : null,
        passengers: pax,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        setQuoteState(
          json.ok
            ? { key: quoteKey, ok: true, total: json.total, lines: json.lines, confirmationMode: json.confirmationMode }
            : { key: quoteKey, ok: false, message: json.message ?? "Cenu nije moguće izračunati." },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setQuoteState({ key: quoteKey, ok: false, message: "Cenu trenutno nije moguće izračunati. Pokušajte ponovo." });
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quoteKey encodes every input
  }, [quoteKey]);

  const quote = quoteKey && quoteState?.key === quoteKey ? quoteState : null;
  const quoteLoading = Boolean(quoteKey) && !quote;

  const phoneFull = composePhone(dial, nationalPhone);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!route) e.route = "Izaberite polazak i destinaciju.";
    if (!outbound) e.trip = "Izaberite datum i vreme polaska.";
    if (wantsReturn && !returnPick) e.return = "Izaberite datum i vreme povratka.";
    if (name.trim().length < 3) e.name = "Unesite ime i prezime.";
    if (!phoneFull || !normalizePhone(phoneFull)) e.phone = "Unesite ispravan broj telefona.";
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = "Unesite ispravnu e-adresu.";
    if (notes.length > 600) e.notes = "Napomena može imati najviše 600 karaktera.";
    return e;
  }

  const focusFirstError = (e: FieldErrors) => {
    const order: (keyof FieldErrors)[] = ["route", "trip", "return", "name", "phone", "email", "notes"];
    const first = order.find((k) => e[k]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`field-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el && "focus" in el) (el as HTMLElement).focus({ preventScroll: true });
    });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    setPriceNotice(false);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0 || !outbound) {
      focusFirstError(e);
      return;
    }
    if (!quote || !quote.ok) {
      setFormError(quote && !quote.ok ? quote.message : "Sačekajte da se izračuna cena.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: outbound.tripId,
          returnTripId: wantsReturn ? returnPick?.tripId : null,
          passengers: pax,
          luggage,
          name: name.trim(),
          phone: phoneFull,
          email: email.trim(),
          notes: notes.trim(),
          idempotencyKey,
          expectedTotal: quote.total,
          website,
        }),
      });
      const json = await res.json().catch(() => null);

      if (json?.ok) {
        router.push(`/booking/confirmation/${json.reference}`);
        return; // keep the button disabled while navigating
      }

      if (json?.code === "VALIDATION" && json.fields) {
        const mapped: FieldErrors = {};
        const f = json.fields as Record<string, string>;
        if (f.name) mapped.name = f.name;
        if (f.phone) mapped.phone = f.phone;
        if (f.email) mapped.email = f.email;
        if (f.notes) mapped.notes = f.notes;
        if (f.tripId) mapped.trip = f.tripId;
        setErrors(mapped);
        setFormError(Object.keys(mapped).length ? null : json.message);
        focusFirstError(mapped);
      } else if (json?.code === "PRICE_CHANGED" && typeof json.newTotal === "number" && quoteKey) {
        setQuoteState({
          key: quoteKey,
          ok: true,
          total: json.newTotal,
          lines: json.newLines ?? [],
          confirmationMode: quote.confirmationMode,
        });
        setPriceNotice(true);
      } else {
        setFormError(json?.message ?? "Došlo je do greške. Pokušajte ponovo.");
        if (json?.code && TRIP_ERRORS.has(json.code)) {
          resetTrips();
          setRefreshToken((n) => n + 1);
        }
      }
    } catch {
      setFormError("Veza sa serverom nije uspela. Proverite internet i pokušajte ponovo.");
    }
    setSubmitting(false);
  }

  const clear = (key: keyof FieldErrors) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const originName = locationById.get(originId)?.name;
  const destName = locationById.get(destinationId)?.name;
  const pricingMode = route?.pricing_mode ?? "per_person";

  return (
    <form
      id="booking-form"
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23.5rem] lg:gap-8"
    >
      <div className="space-y-6">
        {/* 01 — Route */}
        <SectionCard step="01" title="Relacija" description="Izaberite gde krećete i kuda putujete.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="field-route" required>Polazak</Label>
              <Select
                id="field-route"
                value={originId}
                invalid={!!errors.route && !originId}
                aria-describedby={errors.route ? "route-error" : undefined}
                onChange={(ev) => {
                  const id = ev.target.value;
                  setOriginId(id);
                  if (!routes.some((r) => r.origin_id === id && r.destination_id === destinationId)) setDestinationId("");
                  resetTrips();
                  clear("route");
                }}
              >
                <option value="">Izaberite mesto polaska</option>
                {origins.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="field-destination" required>Destinacija</Label>
              <Select
                id="field-destination"
                value={destinationId}
                disabled={!originId}
                invalid={!!errors.route && !destinationId}
                onChange={(ev) => {
                  setDestinationId(ev.target.value);
                  resetTrips();
                  clear("route");
                }}
              >
                <option value="">{originId ? "Izaberite destinaciju" : "Prvo izaberite polazak"}</option>
                {destinations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <FieldError id="route-error" message={errors.route} />

          {origins.length === 0 ? (
            <p role="status" className="mt-5 rounded-xl border border-line bg-card/60 p-4 text-sm text-muted">
              Trenutno nema aktivnih relacija za online rezervaciju. Pošaljite upit putem WhatsApp-a ili nas pozovite.
            </p>
          ) : null}

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">Tip vožnje</legend>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-field p-1">
              {(
                [
                  ["one_way", "U jednom pravcu"],
                  ["return", "Povratna vožnja"],
                ] as const
              ).map(([value, label]) => {
                const disabled = value === "return" && Boolean(route) && !route?.has_return;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                      tripType === value ? "bg-brand text-[#0b0b0b]" : "text-fg hover:bg-white/[0.06]",
                      disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                    )}
                  >
                    <input
                      type="radio"
                      name="tripType"
                      value={value}
                      checked={tripType === value}
                      disabled={disabled}
                      onChange={() => {
                        setTripType(value);
                        setReturnPick(null);
                        setQuoteState(null);
                      }}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {route && !route.has_return ? (
              <p className="mt-2 text-xs text-muted">Povratna vožnja trenutno nije dostupna na ovoj relaciji.</p>
            ) : null}
          </fieldset>
        </SectionCard>

        {/* 02 — Date and time */}
        <SectionCard
          step="02"
          title="Datum i vreme"
          description="Prikazani su samo stvarno slobodni termini. Popunjeni datumi se ne mogu izabrati."
        >
          {route ? (
            <div className="space-y-8">
              <div id="field-trip" tabIndex={-1} className="outline-none">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-brand" aria-hidden="true" />
                  Polazak: {originName} → {destName}
                </p>
                <TripPicker
                  key={route.id}
                  idPrefix="out"
                  routeId={route.id}
                  timezone={tz}
                  currency={currency}
                  maxWindowDays={settings.max_booking_window_days}
                  value={outbound}
                  pricingMode={pricingMode}
                  refreshToken={refreshToken}
                  onChange={(t) => {
                    setOutbound(t);
                    setReturnPick(null);
                    clear("trip");
                  }}
                />
                <FieldError id="trip-error" message={errors.trip} />
              </div>

              {wantsReturn && route.reverse_route_id ? (
                <div id="field-return" tabIndex={-1} className="outline-none">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="size-4 text-brand" aria-hidden="true" />
                    Povratak: {destName} → {originName}
                  </p>
                  {outbound ? (
                    <TripPicker
                      key={`${route.reverse_route_id}-${outbound.tripId}`}
                      idPrefix="ret"
                      routeId={route.reverse_route_id}
                      timezone={tz}
                      currency={currency}
                      maxWindowDays={settings.max_booking_window_days}
                      notBefore={returnNotBefore(outbound.date, outbound.time, tz)}
                      initialMonth={outbound.date.slice(0, 7)}
                      value={returnPick}
                      pricingMode={pricingMode}
                      refreshToken={refreshToken}
                      onChange={(t) => {
                        setReturnPick(t);
                        clear("return");
                      }}
                    />
                  ) : (
                    <p className="rounded-xl border border-line bg-card/60 p-4 text-sm text-muted">
                      Prvo izaberite polazak, zatim će se prikazati termini za povratak.
                    </p>
                  )}
                  <FieldError id="return-error" message={errors.return} />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Izaberite relaciju da vidite slobodne termine.
            </p>
          )}
        </SectionCard>

        {/* 03 — Passengers */}
        <SectionCard step="03" title="Putnici i prtljag">
          <div className="grid gap-5 sm:grid-cols-2">
            <Stepper
              id="passengers"
              label="Broj putnika"
              value={pax}
              min={1}
              max={seatCap}
              Icon={Users}
              onChange={setPassengers}
              hint={
                outbound
                  ? `Na izabranom polasku preostalo je ${seatCap} ${seatCap === 1 ? "mesto" : "mesta"}.`
                  : "Maksimalan broj zavisi od izabranog polaska."
              }
            />
            <Stepper
              id="luggage"
              label="Komada prtljaga"
              value={luggage}
              min={0}
              max={20}
              Icon={Luggage}
              onChange={setLuggage}
              hint="Veći prtljag ili sportsku opremu navedite u napomeni."
            />
          </div>
        </SectionCard>

        {/* 04 — Contact */}
        <SectionCard step="04" title="Vaši podaci" description="Koristimo ih samo za ovu rezervaciju.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="field-name" required>Ime i prezime</Label>
              <Input
                id="field-name"
                autoComplete="name"
                value={name}
                invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                onChange={(ev) => {
                  setName(ev.target.value);
                  clear("name");
                }}
                maxLength={100}
              />
              <FieldError id="name-error" message={errors.name} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="field-phone" required>Broj telefona</Label>
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[11rem_1fr]">
                <Select
                  aria-label="Pozivni broj države"
                  value={dial}
                  onChange={(ev) => setDial(ev.target.value)}
                  className="px-3 pr-8 text-sm"
                >
                  {DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Input
                  id="field-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="61 234 5678"
                  value={nationalPhone}
                  invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
                  onChange={(ev) => {
                    setNationalPhone(ev.target.value);
                    clear("phone");
                  }}
                />
              </div>
              {errors.phone ? (
                <FieldError id="phone-error" message={errors.phone} />
              ) : (
                <p id="phone-hint" className="mt-2 text-xs text-muted">
                  Kontaktiraćemo vas na ovaj broj{phoneFull ? ` (${phoneFull})` : ""}.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="field-email">E-adresa (opciono)</Label>
              <Input
                id="field-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="vase.ime@primer.com"
                value={email}
                invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  clear("email");
                }}
              />
              <FieldError id="email-error" message={errors.email} />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="field-notes">Dodatne napomene (opciono)</Label>
                <span className="text-xs tabular-nums text-muted">{notes.length}/600</span>
              </div>
              <Textarea
                id="field-notes"
                rows={3}
                maxLength={600}
                placeholder="Tačna adresa preuzimanja, dečije sedište, let, posebni zahtevi…"
                value={notes}
                invalid={!!errors.notes}
                onChange={(ev) => {
                  setNotes(ev.target.value);
                  clear("notes");
                }}
              />
              <FieldError id="notes-error" message={errors.notes} />
            </div>

            {/* Honeypot — hidden from people and assistive tech */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Summary */}
      <aside aria-label="Pregled rezervacije" className="lg:sticky lg:top-24">
        <div className="surface-raised rounded-2xl p-5 sm:p-7">
          <h2 className="text-lg font-semibold tracking-tight">Pregled rezervacije</h2>

          <dl className="mt-5 space-y-3.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Relacija</dt>
              <dd className="text-right font-semibold">{originName && destName ? `${originName} → ${destName}` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Polazak</dt>
              <dd className="text-right font-semibold">{outbound ? `${formatDateSrFromKey(outbound.date)} u ${outbound.time}` : "—"}</dd>
            </div>
            {wantsReturn ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Povratak</dt>
                <dd className="text-right font-semibold">{returnPick ? `${formatDateSrFromKey(returnPick.date)} u ${returnPick.time}` : "—"}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Putnika</dt>
              <dd className="font-semibold">{pax}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-hair pt-5" aria-live="polite">
            {quoteLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted" role="status">
                <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" /> Računamo cenu…
              </p>
            ) : quote && quote.ok ? (
              <>
                <ul className="space-y-2.5 text-sm">
                  {quote.lines.map((l, i) => (
                    <li key={i} className="flex items-start justify-between gap-4">
                      <span>
                        <span className="text-fg">{l.label}</span>
                        {l.detail ? <span className="block text-xs text-muted">{l.detail}</span> : null}
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(l.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-baseline justify-between border-t border-hair pt-4">
                  <span className="text-sm font-semibold">Ukupno</span>
                  <span className="text-2xl font-bold tabular-nums tracking-tight">{formatMoney(quote.total, currency)}</span>
                </div>
                <p className="mt-1 text-right text-xs text-muted">Plaćanje se dogovara direktno sa vozačem / operaterom.</p>
              </>
            ) : quote && !quote.ok ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {quote.message}
              </p>
            ) : (
              <p className="text-sm text-muted">Izaberite termin da vidite cenu.</p>
            )}
          </div>

          {priceNotice ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Cena je u međuvremenu promenjena. Proverite novu cenu iznad i potvrdite ponovo.
            </p>
          ) : null}

          {formError ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {formError}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting || quoteLoading}>
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Slanje…
              </>
            ) : (
              <>
                Pošalji rezervaciju
                <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" aria-hidden="true" />
              </>
            )}
          </Button>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {settings.confirmation_mode === "auto"
              ? "Rezervacija se potvrđuje automatski čim je pošaljete."
              : "Rezervaciju potvrđujemo ručno. Do potvrde je status „na čekanju“, a mesta ostaju rezervisana za vas."}
          </p>

          {settings.cancellation_policy ? (
            <details className="mt-4 text-xs text-muted">
              <summary className="cursor-pointer font-semibold text-fg/80 hover:text-fg">Uslovi otkazivanja</summary>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{settings.cancellation_policy}</p>
            </details>
          ) : null}

          {outbound ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted">
              <CheckCircle2 className="size-3.5 text-brand" aria-hidden="true" /> Termin je proveren u realnom vremenu.
            </p>
          ) : null}
        </div>
      </aside>
    </form>
  );
}
