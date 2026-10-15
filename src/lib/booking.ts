import { z } from "zod";
import { startOfDay, startOfToday } from "@/lib/dates";

export const MIN_PASSENGERS = 1;
export const MAX_PASSENGERS = 8;

export const vehicleTypes = ["car"] as const;
export type VehicleType = (typeof vehicleTypes)[number];

export const vehicleLabels: Record<VehicleType, string> = {
  car: "Putnički automobil",
};

export const bookingSchema = z
  .object({
    origin: z
      .string({ error: "Unesite mesto polaska." })
      .trim()
      .min(2, "Unesite mesto polaska.")
      .max(80, "Naziv mesta je predugačak."),
    destination: z
      .string({ error: "Izaberite ili unesite destinaciju." })
      .trim()
      .min(2, "Izaberite ili unesite destinaciju.")
      .max(80, "Naziv destinacije je predugačak."),
    departureDate: z.date({ error: "Izaberite datum polaska." }),
    roundTrip: z.boolean(),
    returnDate: z.date({ error: "Izaberite datum povratka." }).optional(),
    passengers: z
      .number()
      .int()
      .min(MIN_PASSENGERS, "Minimalan broj putnika je 1.")
      .max(MAX_PASSENGERS, "Maksimalan broj putnika je 8."),
    vehicle: z.enum(vehicleTypes, { error: "Izaberite tip vozila." }),
    name: z
      .string({ error: "Unesite ime i prezime." })
      .trim()
      .min(3, "Unesite ime i prezime.")
      .max(80, "Ime je predugačko."),
    phone: z
      .string({ error: "Unesite broj telefona." })
      .trim()
      .min(1, "Unesite broj telefona.")
      .regex(/^\+?[0-9\s\-/().]+$/, "Broj telefona može sadržati samo cifre, razmake i znak +.")
      .refine((v) => {
        const digits = v.replace(/\D/g, "").length;
        return digits >= 7 && digits <= 15;
      }, "Unesite ispravan broj telefona (7–15 cifara)."),
    notes: z.string().trim().max(600, "Napomena može imati najviše 600 karaktera.").optional(),
  })
  .superRefine((data, ctx) => {
    // `when: () => true` below makes these cross-field checks run even when
    // other fields are invalid, so every error is shown in a single pass.
    if (data.departureDate && startOfDay(data.departureDate) < startOfToday()) {
      ctx.addIssue({
        code: "custom",
        path: ["departureDate"],
        message: "Datum polaska ne može biti u prošlosti.",
      });
    }

    if (data.roundTrip) {
      if (!data.returnDate) {
        ctx.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Izaberite datum povratka.",
        });
      } else if (data.departureDate && startOfDay(data.returnDate) < startOfDay(data.departureDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Datum povratka ne može biti pre datuma polaska.",
        });
      }
    }

    if (data.origin && data.destination && data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Destinacija mora biti različita od mesta polaska.",
      });
    }
  }, { when: () => true });

export type BookingFormValues = z.infer<typeof bookingSchema>;
