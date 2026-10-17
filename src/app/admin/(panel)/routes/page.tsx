import type { Metadata } from "next";
import { RoutesManager, type RouteListItem } from "@/components/admin/routes-manager";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadDestinations, loadRouteOptions } from "@/lib/admin/data";
import type { Fee, RouteRow } from "@/lib/reservations/types";

export const metadata: Metadata = { title: "Relacije i cene" };

export default async function RoutesPage() {
  const { supabase, isManager } = await requireAdminPage();
  const [options, destinations, routesRes, bookingsRes, tripsRes] = await Promise.all([
    loadRouteOptions(supabase),
    loadDestinations(supabase),
    supabase.from("routes").select("*"),
    supabase.from("bookings").select("route_id").limit(20000),
    supabase.from("trips").select("route_id").neq("status", "cancelled").gte("departure_at", new Date().toISOString()).limit(20000),
  ]);
  if (routesRes.error) throw routesRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (tripsRes.error) throw tripsRes.error;

  const rows = new Map(((routesRes.data ?? []) as RouteRow[]).map((r) => [r.id, r]));
  const count = (list: { route_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of list ?? []) m.set(r.route_id, (m.get(r.route_id) ?? 0) + 1);
    return m;
  };
  const bookings = count(bookingsRes.data);
  const trips = count(tripsRes.data);

  const items: RouteListItem[] = options.flatMap((o) => {
    const r = rows.get(o.id);
    if (!r) return [];
    return [
      {
        id: r.id,
        label: o.label,
        originId: r.origin_id,
        destinationId: r.destination_id,
        pricingMode: r.pricing_mode,
        basePrice: Number(r.base_price),
        returnPrice: r.return_price === null ? null : Number(r.return_price),
        allowReturn: r.allow_return,
        fees: ((r.fees ?? []) as Fee[]).map((f) => ({ ...f, amount: Number(f.amount) })),
        notes: r.notes,
        isActive: r.is_active,
        bookings: bookings.get(r.id) ?? 0,
        upcomingTrips: trips.get(r.id) ?? 0,
      },
    ];
  });

  const { data: settings } = await supabase.from("settings").select("currency").eq("id", 1).maybeSingle();

  return (
    <RoutesManager
      routes={items}
      destinations={destinations.filter((d) => d.is_active).map((d) => ({ id: d.id, name: d.name, isPickup: d.is_pickup, isDestination: d.is_destination }))}
      currency={settings?.currency ?? "EUR"}
      canManage={isManager}
    />
  );
}
