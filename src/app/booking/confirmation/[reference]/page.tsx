import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, Clock3, Phone, XCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { BookingShell, SetupNotice } from "@/components/booking-system/booking-shell";
import { ButtonLink } from "@/components/ui/button";
import { telHref } from "@/components/contact-section";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/reservations/pricing";
import { getPublicBooking, getSettings } from "@/lib/reservations/public-data";
import { formatDateTimeSr } from "@/lib/reservations/time";
import { STATUS_LABELS } from "@/lib/reservations/types";
import { isBookingSystemConfigured, missingSupabaseEnv } from "@/lib/supabase/env";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Potvrda rezervacije",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({ params }: { params: Promise<{ reference: string }> }) {
  await connection();
  const { reference: raw } = await params;
  const reference = decodeURIComponent(raw).toUpperCase();

  if (!isBookingSystemConfigured()) {
    return (
      <BookingShell>
        <SetupNotice missing={missingSupabaseEnv()} />
      </BookingShell>
    );
  }

  const [booking, settings] = await Promise.all([getPublicBooking(reference), getSettings()]);
  if (!booking) notFound();

  const tz = settings.timezone;
  const pending = booking.status === "pending";
  const cancelled = booking.status === "cancelled";
  const phone = settings.company_phone || siteConfig.contact.phone;

  const message = [
    "Poštovani Adrirora Travel,",
    `upravo sam poslao/la rezervaciju ${booking.reference}.`,
    `Relacija: ${booking.origin_name} → ${booking.destination_name}`,
    `Polazak: ${formatDateTimeSr(booking.departure_at, tz)}`,
    ...(booking.return_departure_at ? [`Povratak: ${formatDateTimeSr(booking.return_departure_at, tz)}`] : []),
    `Putnika: ${booking.passengers}`,
  ].join("\n");

  const Icon = cancelled ? XCircle : pending ? Clock3 : CheckCircle2;
  const tone = cancelled ? "text-danger" : pending ? "text-brand" : "text-whatsapp";
  const headline = cancelled ? "Rezervacija je otkazana" : pending ? "Rezervacija je primljena" : "Rezervacija je potvrđena";

  return (
    <BookingShell>
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <span className={`mx-auto grid size-16 place-items-center rounded-full border border-line bg-card ${tone}`}>
              <Icon className="size-8" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{headline}</h1>
            <p className="mt-3 text-muted">
              {cancelled
                ? `${booking.first_name}, ova rezervacija više nije aktivna.`
                : pending
                  ? `Hvala, ${booking.first_name}. Mesta su rezervisana za vas, a mi ćemo rezervaciju potvrditi u najkraćem roku.`
                  : `Hvala, ${booking.first_name}. Vaš prevoz je potvrđen — vidimo se na polasku.`}
            </p>
          </div>

          <div className="surface-raised mt-10 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Broj rezervacije</p>
                <p className="mt-1 text-2xl font-bold tracking-[0.08em]">{booking.reference}</p>
              </div>
              <span
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ${
                  cancelled
                    ? "border-danger/50 text-danger"
                    : pending
                      ? "border-brand/50 text-brand"
                      : "border-whatsapp/50 text-whatsapp"
                }`}
              >
                {STATUS_LABELS[booking.status]}
              </span>
            </div>

            <dl className="mt-5 space-y-3.5 text-sm">
              <Row label="Relacija" value={`${booking.origin_name} → ${booking.destination_name}`} />
              <Row label="Polazak" value={formatDateTimeSr(booking.departure_at, tz)} />
              {booking.return_departure_at ? (
                <Row label="Povratak" value={formatDateTimeSr(booking.return_departure_at, tz)} />
              ) : null}
              <Row label="Putnika" value={String(booking.passengers)} />
              <Row label="Prtljag" value={`${booking.luggage} kom.`} />
            </dl>

            <ul className="mt-5 space-y-2 border-t border-hair pt-5 text-sm">
              {booking.price_breakdown.map((l, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span className="text-muted">{l.label}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(Number(l.amount), booking.currency)}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between border-t border-hair pt-4">
                <span className="font-semibold">Ukupno</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatMoney(Number(booking.total_price), booking.currency)}
                </span>
              </li>
            </ul>
          </div>

          {!cancelled ? (
            <div className="mt-6 rounded-2xl border border-line bg-card/60 p-6 text-sm">
              <h2 className="font-semibold">Sledeći koraci</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted marker:text-brand">
                <li>Sačuvajte broj rezervacije <strong className="text-fg">{booking.reference}</strong>.</li>
                {pending ? (
                  <li>Kontaktiraćemo vas na broj koji ste ostavili čim potvrdimo rezervaciju.</li>
                ) : (
                  <li>Budite spremni na adresi preuzimanja 10 minuta pre polaska.</li>
                )}
                <li>Za izmene ili otkazivanje javite nam se putem telefona ili WhatsApp-a uz broj rezervacije.</li>
              </ol>
              {settings.cancellation_policy ? (
                <p className="mt-4 whitespace-pre-line border-t border-hair pt-4 text-xs leading-relaxed text-muted">
                  <strong className="text-fg/80">Uslovi otkazivanja:</strong> {settings.cancellation_policy}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href={buildWhatsAppUrl(message)} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg">
              <WhatsAppIcon className="size-5" />
              Pošaljite detalje na WhatsApp
            </ButtonLink>
            {phone ? (
              <ButtonLink href={telHref(phone)} variant="outline" size="lg">
                <Phone className="size-5 text-brand" aria-hidden="true" />
                Pozovite nas
              </ButtonLink>
            ) : null}
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/" className="font-semibold text-fg underline underline-offset-4 hover:text-brand">
              Nazad na početnu stranicu
            </Link>
          </p>
        </div>
      </div>
    </BookingShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
