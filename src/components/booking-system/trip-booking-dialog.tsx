"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Info, Loader2, Luggage, ShieldCheck, Users } from "lucide-react";
import { FieldError, Stepper } from "@/components/booking-system/booking-fields";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/uuid";
import { DIAL_CODES, composePhone } from "@/lib/reservations/phone-codes";
import { formatMoney } from "@/lib/reservations/pricing";
import { formatDateSrFromKey, weekdayLong, weekdayOfKey } from "@/lib/reservations/time";
import type { QuoteLine } from "@/lib/reservations/types";
import type { UpcomingTrip } from "@/lib/reservations/public-data";
import { EMAIL_RE, normalizePhone } from "@/lib/reservations/validation";

export type TripsApiSettings = {
  currency: string;
  timezone: string;
  confirmation_mode: "auto" | "manual";
  cancellation_policy: string;
};

type QuoteState =
  | { key: string; ok: true; total: number; lines: QuoteLine[] }
  | { key: string; ok: false; message: string };

type ReturnState = { key: string; trips?: UpcomingTrip[]; error?: boolean };
type FieldErrors = Partial<Record<"return" | "name" | "phone" | "email" | "notes", string>>;

const STALE_TRIP_CODES = new Set([
  "TRIP_NOT_FOUND", "TRIP_CANCELLED", "TRIP_FULL", "NOT_ENOUGH_SEATS", "TOO_SOON", "TOO_FAR", "DATE_BLOCKED",
  "ROUTE_INACTIVE", "INVALID_RETURN_TRIP", "RETURN_BEFORE_DEPARTURE",
]);

export const shortDate = (date: string) => formatDateSrFromKey(date).replace(/ \d{4}\.$/, "");
const dayName = (date: string) => weekdayLong(weekdayOfKey(date));

export function TripBookingDialog({
  trip,
  settings,
  onClose,
  onStale,
}: {
  trip: UpcomingTrip | null;
  settings: TripsApiSettings;
  onClose: () => void;
  /** The server reported that a slot is gone / changed: the list should be refreshed. */
  onStale: (message: string) => void;
}) {
  return (
    <Modal
      open={Boolean(trip)}
      onClose={onClose}
      size="lg"
      title={trip ? `${trip.originName} → ${trip.destinationName}` : "Rezervacija"}
      description={trip ? `${dayName(trip.date)}, ${formatDateSrFromKey(trip.date)} u ${trip.time}` : undefined}
    >
      {trip ? <DialogForm key={trip.id} trip={trip} settings={settings} onStale={(message) => { onStale(message); onClose(); }} /> : null}
    </Modal>
  );
}

function DialogForm({ trip, settings, onStale }: { trip: UpcomingTrip; settings: TripsApiSettings; onStale: (message: string) => void }) {
  const router = useRouter();
  const { currency } = settings;

  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(0);
  const [wantsReturn, setWantsReturn] = useState(false);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<ReturnState | null>(null);

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

  const returnTrip = wantsReturn ? (returnState?.trips?.find((t) => t.id === returnId) ?? null) : null;
  const seatCap = Math.max(1, Math.min(trip.remaining, returnTrip ? returnTrip.remaining : 60));
  const pax = Math.min(passengers, seatCap);
  const phoneFull = composePhone(dial, nationalPhone);

  // Return trips: real trips on the reverse route, after this departure.
  const returnKey = wantsReturn && trip.reverseRouteId ? `${trip.reverseRouteId}|${trip.departureAt}` : null;
  useEffect(() => {
    if (!returnKey || !trip.reverseRouteId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ routeId: trip.reverseRouteId, notBefore: trip.departureAt, isReturn: "1" });
    fetch(`/api/booking/trips?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => setReturnState(json.ok ? { key: returnKey, trips: json.trips } : { key: returnKey, error: true }))
      .catch(() => {
        if (!controller.signal.aborted) setReturnState({ key: returnKey, error: true });
      });
    return () => controller.abort();
  }, [returnKey, trip.reverseRouteId, trip.departureAt]);
  const returnLoaded = returnKey && returnState?.key === returnKey ? returnState : null;
  const returnLoading = Boolean(returnKey) && !returnLoaded;

  // Price, always calculated by the server.
  const quoteKey = !wantsReturn || returnTrip ? `${trip.id}|${returnTrip?.id ?? ""}|${pax}` : null;
  useEffect(() => {
    if (!quoteKey) return;
    const controller = new AbortController();
    fetch("/api/booking/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: trip.id, returnTripId: returnTrip?.id ?? null, passengers: pax }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) =>
        setQuoteState(
          json.ok
            ? { key: quoteKey, ok: true, total: json.total, lines: json.lines }
            : { key: quoteKey, ok: false, message: json.message ?? "Cenu nije moguće izračunati." },
        ),
      )
      .catch(() => {
        if (!controller.signal.aborted) setQuoteState({ key: quoteKey, ok: false, message: "Cenu trenutno nije moguće izračunati." });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quoteKey encodes every input
  }, [quoteKey]);
  const quote = quoteKey && quoteState?.key === quoteKey ? quoteState : null;
  const quoteLoading = Boolean(quoteKey) && !quote;

  const clear = (k: keyof FieldErrors) => setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (wantsReturn && !returnTrip) e.return = "Izaberite termin povratka ili isključite povratnu vožnju.";
    if (name.trim().length < 3) e.name = "Unesite ime i prezime.";
    if (!phoneFull || !normalizePhone(phoneFull)) e.phone = "Unesite ispravan broj telefona.";
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = "Unesite ispravnu e-adresu.";
    if (notes.length > 600) e.notes = "Napomena može imati najviše 600 karaktera.";
    return e;
  }

  const focusFirst = (e: FieldErrors) => {
    const first = (["return", "name", "phone", "email", "notes"] as const).find((k) => e[k]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`tb-${first}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
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
    if (Object.keys(e).length > 0) return focusFirst(e);
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
          tripId: trip.id,
          returnTripId: returnTrip?.id ?? null,
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
        const f = json.fields as Record<string, string>;
        const mapped: FieldErrors = { name: f.name, phone: f.phone, email: f.email, notes: f.notes };
        setErrors(mapped);
        setFormError(Object.values(mapped).some(Boolean) ? null : json.message);
        focusFirst(mapped);
      } else if (json?.code === "PRICE_CHANGED" && typeof json.newTotal === "number" && quoteKey) {
        setQuoteState({ key: quoteKey, ok: true, total: json.newTotal, lines: json.newLines ?? [] });
        setPriceNotice(true);
      } else if (json?.code && STALE_TRIP_CODES.has(json.code)) {
        onStale(json.message ?? "Ovaj termin više nije dostupan.");
        return;
      } else {
        setFormError(json?.message ?? "Došlo je do greške. Pokušajte ponovo.");
      }
    } catch {
      setFormError("Veza sa serverom nije uspela. Proverite internet i pokušajte ponovo.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
      <section aria-label="Putnici" className="grid gap-5 sm:grid-cols-2">
        <Stepper
          id="tb-passengers"
          label="Broj putnika"
          value={pax}
          min={1}
          max={seatCap}
          Icon={Users}
          onChange={setPassengers}
          hint={`Preostalo ${seatCap} ${seatCap === 1 ? "mesto" : "mesta"} na ovom polasku.`}
        />
        <Stepper id="tb-luggage" label="Komada prtljaga" value={luggage} min={0} max={20} Icon={Luggage} onChange={setLuggage} />
      </section>

      {trip.hasReturn && trip.reverseRouteId ? (
        <section aria-label="Povratak">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-field/50 p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
            <input
              type="checkbox"
              checked={wantsReturn}
              onChange={(e) => {
                setWantsReturn(e.target.checked);
                setReturnId(null);
                setQuoteState(null);
                clear("return");
              }}
              className="mt-1 size-4 accent-[var(--color-brand)]"
            />
            <span>
              <span className="block text-sm font-semibold">Dodaj povratnu vožnju</span>
              <span className="text-xs text-muted">
                {trip.destinationName} → {trip.originName}
              </span>
            </span>
          </label>

          {wantsReturn ? (
            <div id="tb-return" tabIndex={-1} className="mt-3 outline-none">
              {returnLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted" role="status">
                  <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" /> Učitavamo termine povratka…
                </p>
              ) : returnLoaded?.error ? (
                <p role="alert" className="text-sm text-danger">Termine povratka trenutno nije moguće učitati.</p>
              ) : (returnLoaded?.trips ?? []).length === 0 ? (
                <p role="status" className="rounded-xl border border-line p-4 text-sm text-muted">
                  Trenutno nema slobodnih termina za povratak posle ovog polaska. Isključite povratak ili nas kontaktirajte.
                </p>
              ) : (
                <fieldset>
                  <legend className="sr-only">Termin povratka</legend>
                  <ul className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {(returnLoaded?.trips ?? []).map((t) => {
                      const selected = t.id === returnId;
                      return (
                        <li key={t.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                              selected ? "border-brand bg-brand/10" : "border-line hover:border-white/30",
                            )}
                          >
                            <input
                              type="radio"
                              name="return-trip"
                              className="sr-only"
                              checked={selected}
                              onChange={() => {
                                setReturnId(t.id);
                                clear("return");
                              }}
                            />
                            <span>
                              <span className="block font-semibold">{shortDate(t.date)} · {t.time}</span>
                              <span className="text-xs capitalize text-muted">{dayName(t.date)}</span>
                            </span>
                            <span className="text-right text-xs text-muted">
                              {t.remaining} {t.remaining === 1 ? "mesto" : "mesta"}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              )}
              <FieldError id="return-error" message={errors.return} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Vaši podaci" className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="tb-name" required>Ime i prezime</Label>
          <Input
            id="tb-name"
            autoComplete="name"
            value={name}
            maxLength={100}
            invalid={!!errors.name}
            onChange={(e) => {
              setName(e.target.value);
              clear("name");
            }}
          />
          <FieldError id="tb-name-error" message={errors.name} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="tb-phone" required>Broj telefona</Label>
          <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[11rem_1fr]">
            <Select aria-label="Pozivni broj države" value={dial} onChange={(e) => setDial(e.target.value)} className="px-3 pr-8 text-sm">
              {DIAL_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Input
              id="tb-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="61 234 5678"
              value={nationalPhone}
              invalid={!!errors.phone}
              onChange={(e) => {
                setNationalPhone(e.target.value);
                clear("phone");
              }}
            />
          </div>
          <FieldError id="tb-phone-error" message={errors.phone} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="tb-email">E-adresa (opciono)</Label>
          <Input
            id="tb-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vase.ime@primer.com"
            value={email}
            invalid={!!errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              clear("email");
            }}
          />
          <FieldError id="tb-email-error" message={errors.email} />
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="tb-notes">Napomena (opciono)</Label>
            <span className="text-xs tabular-nums text-muted">{notes.length}/600</span>
          </div>
          <Textarea
            id="tb-notes"
            rows={2}
            maxLength={600}
            placeholder="Tačna adresa preuzimanja, dečije sedište, broj leta…"
            value={notes}
            invalid={!!errors.notes}
            onChange={(e) => {
              setNotes(e.target.value);
              clear("notes");
            }}
          />
          <FieldError id="tb-notes-error" message={errors.notes} />
        </div>

        {/* Honeypot: hidden from people and assistive tech */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
      </section>

      <section aria-label="Cena" className="rounded-2xl border border-line bg-field/40 p-5" aria-live="polite">
        {quoteLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted" role="status">
            <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" /> Računamo cenu…
          </p>
        ) : quote && quote.ok ? (
          <>
            <ul className="space-y-2 text-sm">
              {quote.lines.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-4">
                  <span>
                    <span>{l.label}</span>
                    {l.detail ? <span className="block text-xs text-muted">{l.detail}</span> : null}
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(l.amount, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-hair pt-3">
              <span className="text-sm font-semibold">Ukupno</span>
              <span className="text-2xl font-bold tabular-nums tracking-tight">{formatMoney(quote.total, currency)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-muted">Plaćanje se dogovara direktno sa vozačem.</p>
          </>
        ) : quote && !quote.ok ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {quote.message}
          </p>
        ) : (
          <p className="text-sm text-muted">Izaberite termin povratka da vidite cenu.</p>
        )}
      </section>

      {priceNotice ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Cena je u međuvremenu promenjena. Proverite novu cenu i potvrdite ponovo.
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {formError}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || quoteLoading}>
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
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {settings.confirmation_mode === "auto"
            ? "Rezervacija se potvrđuje automatski čim je pošaljete."
            : "Rezervaciju potvrđujemo ručno. Do potvrde je status „na čekanju“, a mesta ostaju rezervisana za vas."}
        </p>
        {settings.cancellation_policy ? (
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer font-semibold text-fg/80 hover:text-fg">Uslovi otkazivanja</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{settings.cancellation_policy}</p>
          </details>
        ) : null}
      </div>
    </form>
  );
}
