import { NextResponse } from "next/server";
import { z } from "zod";
import { getUpcomingTrips } from "@/lib/reservations/public-data";
import { isBookingSystemConfigured } from "@/lib/supabase/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  routeId: z.uuid().optional(),
  notBefore: z.iso.datetime({ offset: true }).optional(),
  isReturn: z.enum(["0", "1"]).optional(),
});

/** Public list of bookable trips. Contains no customer data. */
export async function GET(request: Request) {
  if (!isBookingSystemConfigured()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!rateLimit(`trips:${clientIp(request)}`, 90, 60_000)) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });

  try {
    const { settings, trips } = await getUpcomingTrips({
      routeId: parsed.data.routeId,
      notBefore: parsed.data.notBefore ?? null,
      isReturn: parsed.data.isReturn === "1",
      limit: parsed.data.routeId ? 40 : 36,
    });
    return NextResponse.json(
      {
        ok: true,
        settings: {
          currency: settings.currency,
          timezone: settings.timezone,
          confirmation_mode: settings.confirmation_mode,
          cancellation_policy: settings.cancellation_policy,
        },
        trips,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[trips]", error);
    return NextResponse.json({ ok: false, error: "UNKNOWN" }, { status: 500 });
  }
}
