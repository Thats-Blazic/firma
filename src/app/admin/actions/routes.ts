"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAdminAction } from "@/lib/admin/auth";
import { fail, ok } from "@/lib/admin/result";

const money = (label: string) =>
  z
    .number({ error: `${label}: unesite iznos.` })
    .min(0, `${label} ne može biti negativna.`)
    .max(100000, `${label} je prevelika.`)
    .transform((n) => Math.round(n * 100) / 100);

const routeSchema = z.object({
  id: z.uuid().optional(),
  originId: z.uuid("Izaberite polazište."),
  destinationId: z.uuid("Izaberite destinaciju."),
  pricingMode: z.enum(["per_person", "per_vehicle"]),
  basePrice: money("Cena"),
  returnPrice: money("Cena povratka").nullable(),
  allowReturn: z.boolean(),
  fees: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Naziv dodatne naknade je obavezan.").max(60),
        amount: money("Naknada"),
        per: z.enum(["booking", "person"]),
      }),
    )
    .max(10, "Najviše 10 dodatnih naknada."),
  notes: z.string().trim().max(500).default(""),
  isActive: z.boolean(),
});

export type RouteInput = z.input<typeof routeSchema>;

const refresh = () => revalidatePath("/admin", "layout");

export async function saveRoute(input: RouteInput) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    const parsed = routeSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const r = parsed.data;
    if (r.originId === r.destinationId) return fail("Polazište i destinacija moraju biti različiti.");

    const row = {
      origin_id: r.originId,
      destination_id: r.destinationId,
      pricing_mode: r.pricingMode,
      base_price: r.basePrice,
      return_price: r.returnPrice,
      allow_return: r.allowReturn,
      fees: r.fees,
      notes: r.notes,
      is_active: r.isActive,
    };

    const { error } = r.id
      ? await supabase.from("routes").update(row).eq("id", r.id)
      : await supabase.from("routes").insert(row);
    if (error) {
      if (error.code === "23505") return fail("Relacija između ove dve lokacije već postoji.");
      throw error;
    }
    refresh();
    return ok(undefined, r.id ? "Relacija je sačuvana. Nove cene važe za buduće rezervacije." : "Relacija je dodata.");
  });
}

export async function setRouteActive(id: string, active: boolean) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase.from("routes").update({ is_active: active }).eq("id", id);
    if (error) throw error;
    refresh();
    return ok(undefined, active ? "Relacija je omogućena." : "Relacija je onemogućena za nove rezervacije.");
  });
}

/** Routes that already have trips or bookings are deactivated instead of deleted. */
export async function deleteRoute(id: string) {
  return runAdminAction<{ deleted: boolean }>({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const [{ count: trips }, { count: bookings }] = await Promise.all([
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("route_id", id),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("route_id", id),
    ]);
    if ((trips ?? 0) > 0 || (bookings ?? 0) > 0) {
      const { error } = await supabase.from("routes").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      refresh();
      return ok({ deleted: false }, "Relacija ima polaske ili rezervacije, pa je onemogućena umesto obrisana.");
    }
    const { error } = await supabase.from("routes").delete().eq("id", id);
    if (error) throw error;
    refresh();
    return ok({ deleted: true }, "Relacija je obrisana.");
  });
}
