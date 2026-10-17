import { NextResponse } from "next/server";
import { AdminAuthError, loadSettings, requireAdminAction } from "@/lib/admin/auth";
import { applyBookingFilters } from "@/lib/admin/booking-filters";
import { formatDateShort, toZoned } from "@/lib/reservations/time";
import { STATUS_LABELS, type BookingRow } from "@/lib/reservations/types";

/** Prevents spreadsheet formula injection from customer-supplied text. */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdminAction();
    const settings = await loadSettings(supabase);
    const tz = settings.timezone;
    const params = new URL(request.url).searchParams;

    const { data, error } = await applyBookingFilters(
      supabase.from("bookings").select("*"),
      {
        q: params.get("q") ?? undefined,
        status: params.get("status") ?? undefined,
        route: params.get("route") ?? undefined,
        trip: params.get("trip") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      },
      tz,
    )
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw error;

    const header = [
      "Broj rezervacije", "Status", "Ime i prezime", "Telefon", "E-adresa", "Polazište", "Destinacija",
      "Datum polaska", "Vreme polaska", "Datum povratka", "Vreme povratka", "Putnika", "Prtljag",
      "Ukupna cena", "Valuta", "Napomena klijenta", "Interna beleška", "Kreirano",
    ];
    const lines = [header.map(cell).join(",")];
    for (const b of (data ?? []) as BookingRow[]) {
      const dep = toZoned(b.departure_at, tz);
      const ret = b.return_departure_at ? toZoned(b.return_departure_at, tz) : null;
      lines.push(
        [
          b.reference, STATUS_LABELS[b.status], b.customer_name, b.customer_phone, b.customer_email,
          b.origin_name, b.destination_name, formatDateShort(b.departure_at, tz), dep.time,
          ret ? formatDateShort(b.return_departure_at!, tz) : "", ret?.time ?? "", b.passengers, b.luggage,
          Number(b.total_price).toFixed(2), b.currency, b.notes, b.internal_notes, `${formatDateShort(b.created_at, tz)} ${toZoned(b.created_at, tz).time}`,
        ]
          .map(cell)
          .join(","),
      );
    }

    const stamp = toZoned(new Date(), tz).date;
    return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rezervacije-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.kind === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED" }, { status: error.kind === "forbidden" ? 403 : 401 });
    }
    console.error("[export]", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
