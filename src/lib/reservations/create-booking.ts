import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { buildQuote } from "@/lib/reservations/public-data";
import { messageForCode } from "@/lib/reservations/errors";
import type { BookingRequest } from "@/lib/reservations/validation";
import type { QuoteLine } from "@/lib/reservations/types";

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      reference: string;
      status: "pending" | "confirmed";
      duplicate: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
      /** Present when the price changed: the customer must confirm the new total. */
      newTotal?: number;
      newLines?: QuoteLine[];
    };

const KNOWN_CODES = new Set([
  "TRIP_NOT_FOUND", "ROUTE_INACTIVE", "TRIP_CANCELLED", "TRIP_FULL", "TOO_SOON", "TOO_FAR", "DATE_BLOCKED",
  "NOT_ENOUGH_SEATS", "INVALID_PASSENGERS", "INVALID_RETURN_TRIP", "RETURN_BEFORE_DEPARTURE", "PRICE_CHANGED",
  "REFERENCE_FAILED",
]);

/**
 * The only way a public booking is created:
 *  1. recompute availability + price on the server (never trusting the browser),
 *  2. hand the validated data to the `create_booking` database function, which locks the
 *     trip rows and re-checks capacity inside one transaction.
 */
export async function createBooking(input: BookingRequest): Promise<CreateBookingResult> {
  const quoteResult = await buildQuote({
    tripId: input.tripId,
    returnTripId: input.returnTripId ?? null,
    passengers: input.passengers,
  });
  if (!quoteResult.ok) {
    return { ok: false, code: quoteResult.code, message: messageForCode(quoteResult.code) };
  }
  const { quote, versions } = quoteResult.ctx;

  // The customer confirmed a specific total. If the server now computes something else
  // (prices edited meanwhile, or a manipulated request), ask for confirmation again.
  if (input.expectedTotal !== undefined && Math.abs(input.expectedTotal - quote.total) > 0.005) {
    return {
      ok: false,
      code: "PRICE_CHANGED",
      message: messageForCode("PRICE_CHANGED"),
      newTotal: quote.total,
      newLines: quote.lines,
    };
  }

  const { data, error } = await createServiceClient().rpc("create_booking", {
    p: {
      trip_id: input.tripId,
      return_trip_id: input.returnTripId ?? null,
      passengers: input.passengers,
      luggage: input.luggage,
      customer_name: input.name,
      customer_phone: input.phone,
      customer_email: input.email || null,
      notes: input.notes || "",
      idempotency_key: input.idempotencyKey,
      unit_price: quote.unitPrice,
      return_unit_price: quote.returnUnitPrice,
      total_price: quote.total,
      price_breakdown: quote.lines,
      versions,
    },
  });

  if (error) {
    const code = (error.message ?? "").trim();
    if (KNOWN_CODES.has(code)) return { ok: false, code, message: messageForCode(code) };
    console.error("[create_booking] database error", error);
    return { ok: false, code: "UNKNOWN", message: messageForCode("UNKNOWN") };
  }

  const row = data as { id: string; reference: string; status: "pending" | "confirmed"; duplicate: boolean };
  return { ok: true, bookingId: row.id, reference: row.reference, status: row.status, duplicate: row.duplicate };
}
