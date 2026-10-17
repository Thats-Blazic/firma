import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DestinationRow, DriverRow, RouteRow, VehicleRow } from "@/lib/reservations/types";

export type RouteOption = {
  id: string;
  label: string;
  originId: string;
  destinationId: string;
  originName: string;
  destinationName: string;
  pricingMode: RouteRow["pricing_mode"];
  basePrice: number;
  isActive: boolean;
};

/** All routes with readable names, for selects and tables. */
export async function loadRouteOptions(supabase: SupabaseClient): Promise<RouteOption[]> {
  const [{ data: routes, error: e1 }, { data: dest, error: e2 }] = await Promise.all([
    supabase.from("routes").select("*").order("created_at"),
    supabase.from("destinations").select("id,name"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const names = new Map((dest ?? []).map((d) => [d.id as string, d.name as string]));
  return ((routes ?? []) as RouteRow[])
    .map((r) => {
      const originName = names.get(r.origin_id) ?? "?";
      const destinationName = names.get(r.destination_id) ?? "?";
      return {
        id: r.id,
        label: `${originName} → ${destinationName}`,
        originId: r.origin_id,
        destinationId: r.destination_id,
        originName,
        destinationName,
        pricingMode: r.pricing_mode,
        basePrice: Number(r.base_price),
        isActive: r.is_active,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "sr"));
}

export async function loadFleet(supabase: SupabaseClient): Promise<{ vehicles: VehicleRow[]; drivers: DriverRow[] }> {
  const [v, d] = await Promise.all([
    supabase.from("vehicles").select("*").order("name"),
    supabase.from("drivers").select("*").order("name"),
  ]);
  if (v.error) throw v.error;
  if (d.error) throw d.error;
  return { vehicles: (v.data ?? []) as VehicleRow[], drivers: (d.data ?? []) as DriverRow[] };
}

export async function loadDestinations(supabase: SupabaseClient): Promise<DestinationRow[]> {
  const { data, error } = await supabase.from("destinations").select("*").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as DestinationRow[];
}

export function numberParam(value: string | undefined, fallback: number, min = 1, max = 100000) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback;
}

export function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
