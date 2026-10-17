/** Error codes raised by the database functions / server checks, with user-facing text (Serbian). */
export const ERROR_MESSAGES: Record<string, string> = {
  SUPABASE_NOT_CONFIGURED: "Online rezervacije trenutno nisu dostupne. Pošaljite upit putem WhatsApp-a ili nas pozovite.",
  TRIP_NOT_FOUND: "Izabrani polazak više ne postoji. Osvežite stranicu i izaberite drugi termin.",
  ROUTE_INACTIVE: "Ova relacija trenutno nije dostupna za rezervaciju.",
  TRIP_CANCELLED: "Izabrani polazak je otkazan. Izaberite drugi termin.",
  TRIP_FULL: "Izabrani polazak je popunjen. Izaberite drugi termin.",
  TOO_SOON: "Izabrani polazak je prekasan za online rezervaciju. Pozovite nas za hitne vožnje.",
  TOO_FAR: "Izabrani datum je izvan perioda u kojem je rezervacija moguća.",
  DATE_BLOCKED: "Na izabrani datum rezervacije nisu moguće.",
  NOT_ENOUGH_SEATS: "Nema dovoljno slobodnih mesta za izabrani broj putnika.",
  INVALID_PASSENGERS: "Broj putnika nije ispravan.",
  INVALID_RETURN_TRIP: "Izabrani povratni polazak nije dostupan za ovu relaciju.",
  RETURN_BEFORE_DEPARTURE: "Povratak mora biti nakon polaska.",
  PRICE_CHANGED: "Cena je u međuvremenu promenjena. Proverite novu cenu i potvrdite ponovo.",
  REFERENCE_FAILED: "Rezervaciju nije moguće sačuvati u ovom trenutku. Pokušajte ponovo.",
  VALIDATION: "Proverite unete podatke.",
  RATE_LIMITED: "Previše pokušaja. Pokušajte ponovo za nekoliko minuta.",
  UNKNOWN: "Došlo je do greške. Pokušajte ponovo ili nas kontaktirajte.",
};

export function messageForCode(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN;
}

/** Admin-side messages for database / RPC failures. */
export const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Nemate dozvolu za ovu radnju.",
  BOOKING_NOT_FOUND: "Rezervacija nije pronađena.",
  INVALID_STATUS: "Nevažeći status.",
  INVALID_TRANSITION: "Ova promena statusa nije dozvoljena.",
  CAPACITY_BELOW_BOOKED: "Kapacitet ne može biti manji od broja već rezervisanih mesta.",
  HAS_BOOKINGS: "Polazak ima aktivne rezervacije. Potvrdite da ste svesni uticaja na putnike.",
  TOO_MANY_TRIPS: "Previše polazaka u jednom koraku (najviše 400).",
  BOOKING_IMMUTABLE: "Cena i podaci o vožnji u rezervaciji se ne mogu menjati.",
  ...ERROR_MESSAGES,
};

export function adminMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return ADMIN_ERROR_MESSAGES.UNKNOWN;
  const key = (error.message ?? "").trim();
  if (ADMIN_ERROR_MESSAGES[key]) return ADMIN_ERROR_MESSAGES[key];
  if (error.code === "23505") return "Takav zapis već postoji.";
  if (error.code === "23503") return "Zapis je povezan sa drugim podacima i ne može se obrisati ili izmeniti na ovaj način.";
  if (error.code === "42501") return ADMIN_ERROR_MESSAGES.FORBIDDEN;
  if (error.code === "23514") return "Neka od vrednosti nije u dozvoljenom opsegu.";
  return ADMIN_ERROR_MESSAGES.UNKNOWN;
}
