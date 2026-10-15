import { siteConfig } from "@/config/site";
import { vehicleLabels, type BookingFormValues } from "@/lib/booking";
import { formatDateSr } from "@/lib/dates";

/** Builds the Serbian inquiry text that is sent through WhatsApp. */
export function buildBookingMessage(values: BookingFormValues): string {
  const lines: string[] = [
    "Poštovani Adriatic Trans,",
    "",
    "Želeo/la bih da pošaljem upit za rezervaciju prevoza.",
    "",
    `Ime i prezime: ${values.name.trim()}`,
    `Telefon: ${values.phone.trim()}`,
    `Polazak: ${values.origin.trim()}`,
    `Destinacija: ${values.destination.trim()}`,
    `Datum polaska: ${formatDateSr(values.departureDate)}`,
    `Povratna vožnja: ${values.roundTrip ? "Da" : "Ne"}`,
  ];

  if (values.roundTrip && values.returnDate) {
    lines.push(`Datum povratka: ${formatDateSr(values.returnDate)}`);
  }

  lines.push(`Broj putnika: ${values.passengers}`);
  lines.push(`Tip vozila: ${vehicleLabels[values.vehicle]}`);

  const notes = values.notes?.trim();
  if (notes) {
    lines.push(`Dodatne napomene: ${notes}`);
  }

  lines.push("", "Molim vas za informaciju o dostupnosti i ceni prevoza.", "", "Hvala!");

  return lines.join("\n");
}

/** Official click-to-chat URL: https://wa.me/<number>?text=<encoded message> */
export function buildWhatsAppUrl(message?: string, number: string = siteConfig.whatsapp.number): string {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Generic "contact us" link (floating button, contact section, footer). */
export function getGeneralWhatsAppUrl(): string {
  return buildWhatsAppUrl(siteConfig.whatsapp.greeting);
}

/**
 * Opens WhatsApp in a new tab. If the browser blocks the popup (common on
 * iOS Safari / in-app browsers), falls back to same-tab navigation.
 * Returns true when a new tab/window was opened.
 */
export function openWhatsApp(url: string): boolean {
  const win = window.open(url, "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* cross-origin — ignore */
    }
    return true;
  }
  window.location.assign(url);
  return false;
}
