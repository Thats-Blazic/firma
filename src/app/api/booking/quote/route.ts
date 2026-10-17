import { NextResponse } from "next/server";
import { buildQuote } from "@/lib/reservations/public-data";
import { messageForCode } from "@/lib/reservations/errors";
import { quoteRequestSchema } from "@/lib/reservations/validation";
import { isBookingSystemConfigured } from "@/lib/supabase/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!isBookingSystemConfigured()) {
    return NextResponse.json({ ok: false, code: "SUPABASE_NOT_CONFIGURED", message: messageForCode("SUPABASE_NOT_CONFIGURED") }, { status: 503 });
  }
  if (!rateLimit(`quote:${clientIp(request)}`, 90, 60_000)) {
    return NextResponse.json({ ok: false, code: "RATE_LIMITED", message: messageForCode("RATE_LIMITED") }, { status: 429 });
  }
  const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "VALIDATION", message: messageForCode("VALIDATION") }, { status: 400 });
  }

  try {
    const result = await buildQuote(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ ok: false, code: result.code, message: messageForCode(result.code) }, { status: 200 });
    }
    const { quote, settings } = result.ctx;
    return NextResponse.json(
      {
        ok: true,
        currency: quote.currency,
        total: quote.total,
        lines: quote.lines,
        confirmationMode: settings.confirmation_mode,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[quote]", error);
    return NextResponse.json({ ok: false, code: "UNKNOWN", message: messageForCode("UNKNOWN") }, { status: 500 });
  }
}
