import type { Metadata } from "next";
import { TripsManager } from "@/components/admin/trips-manager";
import { loadSettings, requireAdminPage } from "@/lib/admin/auth";
import { loadFleet, loadRouteOptions, numberParam, single } from "@/lib/admin/data";
import { DATE_RE, todayIn, zonedToUtc, addDaysToKey } from "@/lib/reservations/time";
import type { BlockedDateRow, TripAvailabilityRow } from "@/lib/reservations/types";

export const metadata: Metadata = { title: "Polasci" };

const PAGE_SIZE = 30;

export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, isManager } = await requireAdminPage();
  const sp = await searchParams;
  const settings = await loadSettings(supabase);
  const tz = settings.timezone;
  const today = todayIn(tz);

  const rawFrom = single(sp.from);
  const hasFromParam = sp.from !== undefined;
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : hasFromParam ? "" : today;
  const to = single(sp.to);
  const toKey = to && DATE_RE.test(to) ? to : "";
  const route = single(sp.route) ?? "";
  const status = single(sp.status) ?? "";
  const page = numberParam(single(sp.page), 1, 1, 10000);

  let q = supabase.from("trip_availability").select("*", { count: "exact" });
  if (route) q = q.eq("route_id", route);
  if (["scheduled", "full", "cancelled"].includes(status)) q = q.eq("status", status);
  if (from) q = q.gte("departure_at", zonedToUtc(from, "00:00", tz).toISOString());
  if (toKey) q = q.lt("departure_at", zonedToUtc(addDaysToKey(toKey, 1), "00:00", tz).toISOString());

  const [{ data, count, error }, routes, fleet, blockedRes] = await Promise.all([
    q.order("departure_at", { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    loadRouteOptions(supabase),
    loadFleet(supabase),
    supabase.from("blocked_dates").select("*").gte("blocked_on", today).order("blocked_on"),
  ]);
  if (error) throw error;
  if (blockedRes.error) throw blockedRes.error;

  const trips = ((data ?? []) as TripAvailabilityRow[]).map((t) => ({
    ...t,
    price_override: t.price_override === null ? null : Number(t.price_override),
  }));

  return (
    <TripsManager
      trips={trips}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      filters={{ route, status, from, to: toKey }}
      routes={routes.map((r) => ({ id: r.id, label: r.label, pricingMode: r.pricingMode, basePrice: r.basePrice, isActive: r.isActive }))}
      fleet={{
        vehicles: fleet.vehicles.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name, capacity: v.capacity })),
        drivers: fleet.drivers.filter((d) => d.is_active).map((d) => ({ id: d.id, name: d.name })),
      }}
      blocked={(blockedRes.data ?? []) as BlockedDateRow[]}
      today={today}
      defaultCapacity={settings.default_capacity}
      timezone={tz}
      currency={settings.currency}
      canManage={isManager}
    />
  );
}
