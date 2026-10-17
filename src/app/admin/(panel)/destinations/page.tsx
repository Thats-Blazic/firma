import type { Metadata } from "next";
import { DestinationsManager } from "@/components/admin/destinations-manager";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadDestinations } from "@/lib/admin/data";

export const metadata: Metadata = { title: "Destinacije" };

export default async function DestinationsPage() {
  const { supabase, isManager } = await requireAdminPage();
  const [destinations, routes] = await Promise.all([
    loadDestinations(supabase),
    supabase.from("routes").select("origin_id,destination_id"),
  ]);
  if (routes.error) throw routes.error;

  const usage: Record<string, number> = {};
  for (const r of routes.data ?? []) {
    usage[r.origin_id] = (usage[r.origin_id] ?? 0) + 1;
    usage[r.destination_id] = (usage[r.destination_id] ?? 0) + 1;
  }

  return <DestinationsManager destinations={destinations} usage={usage} canManage={isManager} />;
}
