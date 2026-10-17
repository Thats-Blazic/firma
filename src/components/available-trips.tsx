"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Car, Clock, Flag, MapPin, RefreshCw, Users } from "lucide-react";
import { BOOKING_SECTION_ID } from "@/components/booking-context";
import { TripBookingDialog, shortDate, type TripsApiSettings } from "@/components/booking-system/trip-booking-dialog";
import { Reveal, SectionHeading, easeOut } from "@/components/reveal";
import { formatMoney } from "@/lib/reservations/pricing";
import { weekdayLong, weekdayOfKey } from "@/lib/reservations/time";
import type { UpcomingTrip } from "@/lib/reservations/public-data";
import { cn } from "@/lib/utils";

type Loaded =
  | { key: number; status: "ready"; trips: UpcomingTrip[]; settings: TripsApiSettings }
  | { key: number; status: "error" };

/**
 * Live list of bookable departures created in the admin panel.
 * Picking a card opens a short form (passengers, contact) right on the home page.
 */
export function AvailableTrips() {
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [picked, setPicked] = useState<UpcomingTrip | null>(null);
  const [destination, setDestination] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/booking/trips", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) =>
        setLoaded(json.ok ? { key: reload, status: "ready", trips: json.trips, settings: json.settings } : { key: reload, status: "error" }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key: reload, status: "error" });
      });
    return () => controller.abort();
  }, [reload]);

  const loading = !loaded || loaded.key !== reload;
  const ready = loaded && loaded.key === reload && loaded.status === "ready" ? loaded : null;
  const trips = ready?.trips ?? [];
  const destinations = [...new Set(trips.map((t) => t.destinationName))];
  const activeDestination = destinations.includes(destination) ? destination : "";
  const visible = activeDestination ? trips.filter((t) => t.destinationName === activeDestination) : trips;

  return (
    <section
      id={BOOKING_SECTION_ID}
      aria-labelledby="trips-title"
      className="section-y relative scroll-mt-20 overflow-hidden bg-bg"
    >
      <div className="container-page">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index="02"
            id="trips-title"
            eyebrow="Slobodna mesta"
            title="Trenutni polasci."
            description="Prikazani su polasci koji su trenutno slobodni: kada putujemo, kojim vozilom i koliko mesta je ostalo. Izaberite polazak, unesite broj putnika i pošaljite rezervaciju."
          />
          <Reveal delay={0.1}>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 text-sm font-semibold text-fg/80 underline decoration-white/25 underline-offset-[6px] transition-colors hover:text-fg hover:decoration-brand"
            >
              <CalendarDays className="size-4 text-brand" aria-hidden="true" />
              Pretraži po datumu i relaciji
            </Link>
          </Reveal>
        </div>

        {notice ? (
          <p role="alert" className="mt-8 flex items-start justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            <span>{notice} Lista termina je osvežena — izaberite drugi termin.</span>
            <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-semibold underline underline-offset-4">
              U redu
            </button>
          </p>
        ) : null}

        {destinations.length > 1 ? (
          <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filter po destinaciji">
            {["", ...destinations].map((d) => (
              <button
                key={d || "all"}
                type="button"
                aria-pressed={activeDestination === d}
                onClick={() => setDestination(d)}
                className={cn(
                  "h-10 rounded-full border px-4 text-[0.8125rem] font-semibold transition-colors",
                  activeDestination === d ? "border-brand bg-brand text-[#0b0b0b]" : "border-line text-fg/80 hover:border-white/40 hover:text-fg",
                )}
              >
                {d || "Sve destinacije"}
              </button>
            ))}
          </div>
        ) : null}

        <div className={cn(destinations.length > 1 ? "mt-6" : "mt-12 lg:mt-16")}>
          {loading ? (
            <ul aria-busy="true" aria-label="Učitavanje termina" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-card/60" />
              ))}
            </ul>
          ) : !ready ? (
            <div role="alert" className="surface-raised flex flex-col items-start gap-4 rounded-2xl p-8">
              <p className="text-lg font-semibold">Termine trenutno nije moguće učitati.</p>
              <p className="text-sm text-muted">Proverite vezu i pokušajte ponovo, ili nam pošaljite upit putem obrasca ispod.</p>
              <button
                type="button"
                onClick={() => setReload((n) => n + 1)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-semibold hover:border-white/50"
              >
                <RefreshCw className="size-4" aria-hidden="true" /> Pokušaj ponovo
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="surface-raised rounded-2xl p-8 sm:p-10">
              <p className="text-lg font-semibold">Trenutno nema slobodnih termina.</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Novi polasci se dodaju redovno. Pošaljite nam upit ispod ili nas pozovite i dogovorićemo prevoz po vašoj meri.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((trip, i) => (
                <li key={trip.id}>
                  <TripCard trip={trip} index={i} currency={ready.settings.currency} onPick={() => setPicked(trip)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {ready ? (
        <TripBookingDialog
          trip={picked}
          settings={ready.settings}
          onClose={() => setPicked(null)}
          onStale={(message) => {
            setNotice(message);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
    </section>
  );
}

function TripCard({ trip, index, currency, onPick }: { trip: UpcomingTrip; index: number; currency: string; onPick: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const low = trip.remaining <= 2;
  const unit = trip.pricingMode === "per_person" ? "po osobi" : "po vozilu";

  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.8, ease: easeOut, delay: (index % 3) * 0.08 }}
      className="group relative isolate flex min-h-80 cursor-pointer flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-line bg-card p-5 transition-[border-color] duration-700 hover:border-white/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand sm:p-6"
    >
      {trip.imageUrl && !imageFailed ? (
        <Image
          src={trip.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          onError={() => setImageFailed(true)}
          className="-z-20 transform-gpu object-cover brightness-[0.8] saturate-[0.9] transition-transform duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_30%_20%,#2a1a10,#181818_60%)]" />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/35" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/70">{weekdayLong(weekdayOfKey(trip.date))}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-white">{shortDate(trip.date)}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-sm font-semibold tabular-nums text-white backdrop-blur-sm">
          <Clock className="size-3.5 text-brand" aria-hidden="true" />
          {trip.time}
        </span>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/70">
          <MapPin className="size-3.5 text-brand" aria-hidden="true" />
          {trip.destinationCountry || "Prevoz putnika"}
        </p>
        <h3 className="mt-2 text-2xl font-semibold leading-[1.1] tracking-[-0.02em] text-white">
          {trip.originName} <span className="text-brand">→</span> {trip.destinationName}
        </h3>

        {trip.vehicleName || trip.arrivalTime ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] font-medium text-white/80">
            {trip.vehicleName ? (
              <span className="flex items-center gap-1.5">
                <Car className="size-3.5 text-brand" aria-hidden="true" />
                {trip.vehicleName}
              </span>
            ) : null}
            {trip.arrivalTime ? (
              <span className="flex items-center gap-1.5">
                <Flag className="size-3.5 text-brand" aria-hidden="true" />
                Dolazak oko {trip.arrivalTime}
              </span>
            ) : null}
          </p>
        ) : null}
        {trip.note ? <p className="mt-2 line-clamp-3 text-[0.8125rem] leading-relaxed text-white/70">{trip.note}</p> : null}

        <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
          <div>
            <p className="text-lg font-bold tabular-nums text-white">
              {formatMoney(trip.unitPrice, currency)}
              <span className="ml-1.5 text-xs font-medium text-white/65">{unit}</span>
            </p>
            <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs font-semibold", low ? "text-amber-300" : "text-white/70")}>
              <Users className="size-3.5" aria-hidden="true" />
              {low ? "Još " : "Slobodno: "}
              {trip.remaining} {trip.remaining === 1 ? "mesto" : "mesta"}
              <span className="font-normal text-white/50">od {trip.capacity}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onPick}
            aria-label={`Rezerviši: ${trip.originName} do ${trip.destinationName}, ${shortDate(trip.date)} u ${trip.time}`}
            className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-white after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none"
          >
            Rezerviši
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full border border-brand/70 bg-black/20 text-brand backdrop-blur-sm transition-[background-color,color,border-color] duration-500 group-hover:border-brand group-hover:bg-brand group-hover:text-[#0b0b0b]"
            >
              <ArrowRight className="size-4 transition-transform duration-500 ease-out group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
