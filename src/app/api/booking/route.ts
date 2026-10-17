import { NextResponse, after } from "next/server";
import { createBooking } from "@/lib/reservations/create-booking";
import { notifyBooking } from "@/lib/reservations/notify";
import { messageForCode } from "@/lib/reservations/errors";
import { bookingRequestSchema } from "@/lib/reservations/validation";
import { isBookingSystemConfigured } from "@/lib/supabase/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const fail = (code: string, status: number, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: false, code, message: messageForCode(code), ...extra }, { status });

  if (!isBookingSystemConfigured()) return fail("SUPABASE_NOT_CONFIGURED", 503);
  if (!rateLimit(`book:${clientIp(request)}`, 8, 10 * 60_000)) return fail("RATE_LIMITED", 429);

  const body = await request.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fields[key] ??= issue.message;
    }
    return fail("VALIDATION", 400, { fields });
  }

  try {
    const result = await createBooking(parsed.data);
    if (!result.ok) {
      const status = result.code === "UNKNOWN" ? 500 : 409;
      return NextResponse.json(result, { status });
    }
    // Notifications are sent after the response and can never affect the reservation itself.
    if (!result.duplicate) {
      after(() => notifyBooking(result.bookingId, "created"));
    }
    return NextResponse.json({ ok: true, reference: result.reference, status: result.status, duplicate: result.duplicate });
  } catch (error) {
    console.error("[booking]", error);
    return fail("UNKNOWN", 500);
  }
}
