import { z } from "zod";

export const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

/** "00381 61 234" / "+381 (61) 234-56" → "+38161…"; returns "" when it is not a plausible number. */
export function normalizePhone(raw: string): string {
  let value = raw.trim().replace(/[^\d+]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!value.startsWith("+")) value = `+${value}`;
  value = `+${value.slice(1).replace(/\+/g, "")}`;
  return PHONE_E164.test(value) ? value : "";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Request sent by the public booking form. Notice there is NO price in it that the server
 * would trust: `expectedTotal` is only used to detect that the price changed since the
 * customer saw it.
 */
export const bookingRequestSchema = z.object({
  tripId: z.uuid({ error: "Izaberite termin polaska." }),
  returnTripId: z.uuid().optional().nullable(),
  passengers: z
    .number({ error: "Unesite broj putnika." })
    .int("Broj putnika mora biti ceo broj.")
    .min(1, "Minimalan broj putnika je 1.")
    .max(60, "Broj putnika nije ispravan."),
  luggage: z
    .number()
    .int("Broj komada prtljaga mora biti ceo broj.")
    .min(0, "Broj komada prtljaga ne može biti negativan.")
    .max(60, "Broj komada prtljaga nije ispravan."),
  name: z
    .string({ error: "Unesite ime i prezime." })
    .trim()
    .min(3, "Unesite ime i prezime.")
    .max(100, "Ime je predugačko."),
  phone: z
    .string({ error: "Unesite broj telefona." })
    .transform((v) => normalizePhone(v))
    .refine((v) => v !== "", "Unesite ispravan broj telefona sa pozivnim brojem države."),
  email: z
    .string()
    .trim()
    .max(160, "E-adresa je predugačka.")
    .refine((v) => v === "" || EMAIL_RE.test(v), "Unesite ispravnu e-adresu.")
    .optional()
    .default(""),
  notes: z.string().trim().max(600, "Napomena može imati najviše 600 karaktera.").optional().default(""),
  idempotencyKey: z.uuid(),
  expectedTotal: z.number().min(0).max(1_000_000).optional(),
  /** Honeypot: real visitors never fill this in. */
  website: z.string().max(0).optional().default(""),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const quoteRequestSchema = z.object({
  tripId: z.uuid(),
  returnTripId: z.uuid().optional().nullable(),
  passengers: z.number().int().min(1).max(60),
});
