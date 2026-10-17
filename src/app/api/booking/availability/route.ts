import { NextResponse } from "next/server";
import { z } from "zod";
import { getMonthAvailability } from "@/lib/reservations/public-data";
import { isBookingSystemConfigured } from "@/lib/supabase/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  routeId: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  notBefore: z.iso.datetime({ offset: true }).optional(),
});

export async function GET(request: Request) {
  if (!isBookingSystemConfigured()) {
    return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!rateLimit(`avail:${clientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });

  const [year, month] = parsed.data.month.split("-").map(Number);
  try {
    const data = await getMonthAvailability({
      routeId: parsed.data.routeId,
      year,
      monthIndex: month - 1,
      notBefore: parsed.data.notBefore ?? null,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[availability]", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
