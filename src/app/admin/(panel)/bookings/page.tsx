import type { Metadata } from "next";
import { BookingsManager } from "@/components/admin/bookings-manager";
import { loadSettings, requireAdminPage } from "@/lib/admin/auth";
import { applyBookingFilters } from "@/lib/admin/booking-filters";
import { loadRouteOptions, numberParam, single } from "@/lib/admin/data";
import type { BookingRow } from "@/lib/reservations/types";

export const metadata: Metadata = { title: "Rezervacije" };

const PAGE_SIZE = 25;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const settings = await loadSettings(supabase);

  const filters = {
    q: single(sp.q),
    status: single(sp.status),
    route: single(sp.route),
    trip: single(sp.trip),
    from: single(sp.from),
    to: single(sp.to),
  };
  const page = numberParam(single(sp.page), 1, 1, 10000);

  const filtered = applyBookingFilters(supabase.from("bookings").select("*", { count: "exact" }), filters, settings.timezone);
  const [{ data, count, error }, routes] = await Promise.all([
    filtered.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    loadRouteOptions(supabase),
  ]);
  if (error) throw error;

  return (
    <BookingsManager
      bookings={((data ?? []) as BookingRow[]).map((b) => ({ ...b, total_price: Number(b.total_price) }))}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      filters={{
        q: filters.q ?? "",
        status: filters.status ?? "",
        route: filters.route ?? "",
        trip: filters.trip ?? "",
        from: filters.from ?? "",
        to: filters.to ?? "",
      }}
      routes={routes.map((r) => ({ id: r.id, label: r.label }))}
      timezone={settings.timezone}
      currency={settings.currency}
      companyName={settings.company_name}
    />
  );
}
