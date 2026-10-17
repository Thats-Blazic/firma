import type { Metadata } from "next";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { loadSettings, requireAdminPage } from "@/lib/admin/auth";
import { loadFleet, loadRouteOptions, single } from "@/lib/admin/data";
import { daysInMonth, monthBounds, monthKey, todayIn } from "@/lib/reservations/time";
import type { BlockedDateRow, TripAvailabilityRow } from "@/lib/reservations/types";

export const metadata: Metadata = { title: "Kalendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, isManager } = await requireAdminPage();
  const sp = await searchParams;
  const settings = await loadSettings(supabase);
  const tz = settings.timezone;
  const today = todayIn(tz);

  const raw = single(sp.m);
  const match = raw && /^(\d{4})-(0[1-9]|1[0-2])$/.test(raw) ? raw : today.slice(0, 7);
  const year = Number(match.slice(0, 4));
  const monthIndex = Number(match.slice(5, 7)) - 1;
  const route = single(sp.route) ?? "";
  const { start, end } = monthBounds(year, monthIndex, tz);

  let q = supabase
    .from("trip_availability")
    .select("*")
    .gte("departure_at", start.toISOString())
    .lt("departure_at", end.toISOString());
  if (route) q = q.eq("route_id", route);

  let blockedQ = supabase
    .from("blocked_dates")
    .select("*")
    .gte("blocked_on", `${match}-01`)
    .lte("blocked_on", `${match}-${String(daysInMonth(year, monthIndex)).padStart(2, "0")}`);
  if (route) blockedQ = blockedQ.or(`route_id.is.null,route_id.eq.${route}`);

  const [tripsRes, blockedRes, routes, fleet] = await Promise.all([
    q.order("departure_at").limit(1000),
    blockedQ,
    loadRouteOptions(supabase),
    loadFleet(supabase),
  ]);
  if (tripsRes.error) throw tripsRes.error;
  if (blockedRes.error) throw blockedRes.error;

  const trips = ((tripsRes.data ?? []) as TripAvailabilityRow[]).map((t) => ({
    ...t,
    price_override: t.price_override === null ? null : Number(t.price_override),
  }));

  return (
    <AdminCalendar
      year={year}
      monthIndex={monthIndex}
      monthParam={monthKey(year, monthIndex)}
      route={route}
      trips={trips}
      blocked={(blockedRes.data ?? []) as BlockedDateRow[]}
      routes={routes.map((r) => ({ id: r.id, label: r.label, pricingMode: r.pricingMode, basePrice: r.basePrice, isActive: r.isActive }))}
      fleet={{
        vehicles: fleet.vehicles.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name, capacity: v.capacity })),
        drivers: fleet.drivers.filter((d) => d.is_active).map((d) => ({ id: d.id, name: d.name })),
      }}
      today={today}
      defaultCapacity={settings.default_capacity}
      timezone={tz}
      currency={settings.currency}
      canManage={isManager}
    />
  );
}
