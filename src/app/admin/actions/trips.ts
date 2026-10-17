"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { loadSettings, runAdminAction } from "@/lib/admin/auth";
import { fail, ok } from "@/lib/admin/result";
import { notifyBooking } from "@/lib/reservations/notify";
import { addDaysToKey, DATE_RE, TIME_RE, toZoned, weekdayOfKey, zonedToUtc } from "@/lib/reservations/time";
import { uuid } from "@/lib/uuid";

const dateStr = z.string().regex(DATE_RE, "Neispravan datum.");
const timeStr = z.string().regex(TIME_RE, "Neispravno vreme (HH:MM).");
const optionalTime = z.string().refine((v) => v === "" || TIME_RE.test(v), "Neispravno vreme dolaska (HH:MM).").default("");
const price = z
  .number()
  .min(0, "Cena ne može biti negativna.")
  .max(100000, "Cena je prevelika.")
  .transform((n) => Math.round(n * 100) / 100)
  .nullable()
  .default(null);
const optionalId = z.uuid().nullable().default(null);
const capacity = z.number({ error: "Unesite kapacitet." }).int().min(1, "Kapacitet mora biti najmanje 1.").max(100, "Kapacitet je prevelik.");

const tripFields = {
  routeId: z.uuid("Izaberite relaciju."),
  capacity,
  priceOverride: price,
  vehicleId: optionalId,
  driverId: optionalId,
  notes: z.string().trim().max(500).default(""),
};

const singleSchema = z.object({
  ...tripFields,
  date: dateStr,
  time: timeStr,
  arrivalTime: optionalTime,
  status: z.enum(["scheduled", "full"]).default("scheduled"),
});

const recurringSchema = z.object({
  ...tripFields,
  startDate: dateStr,
  endDate: dateStr,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Izaberite bar jedan dan u nedelji."),
  times: z.array(timeStr).min(1, "Dodajte bar jedno vreme polaska.").max(8, "Najviše 8 polazaka dnevno."),
  arrivalOffsetMinutes: z.number().int().min(0).max(24 * 60).nullable().default(null),
});

export type SingleTripInput = z.input<typeof singleSchema>;
export type RecurringTripInput = z.input<typeof recurringSchema>;

const refresh = () => revalidatePath("/admin", "layout");

function buildArrival(date: string, time: string, arrivalTime: string, tz: string): string | null {
  if (!arrivalTime) return null;
  const dep = zonedToUtc(date, time, tz);
  let arr = zonedToUtc(date, arrivalTime, tz);
  if (arr <= dep) arr = zonedToUtc(addDaysToKey(date, 1), arrivalTime, tz);
  return arr.toISOString();
}

function tripRow(
  f: { routeId: string; capacity: number; priceOverride: number | null; vehicleId: string | null; driverId: string | null; notes: string },
  departure: Date,
  arrival: string | null,
  recurrenceId?: string,
) {
  return {
    route_id: f.routeId,
    departure_at: departure.toISOString(),
    arrival_at: arrival,
    capacity: f.capacity,
    price_override: f.priceOverride,
    vehicle_id: f.vehicleId,
    driver_id: f.driverId,
    notes: f.notes,
    recurrence_id: recurrenceId ?? null,
  };
}

export async function createTrip(input: SingleTripInput) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    const parsed = singleSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const t = parsed.data;
    const settings = await loadSettings(supabase);
    const departure = zonedToUtc(t.date, t.time, settings.timezone);
    if (departure.getTime() < Date.now()) return fail("Polazak ne može biti u prošlosti.");

    const { data, error } = await supabase.rpc("create_trips", {
      p_trips: [tripRow(t, departure, buildArrival(t.date, t.time, t.arrivalTime, settings.timezone))],
    });
    if (error) throw error;
    if ((data as { created: number }).created === 0) {
      return fail("Polazak na ovoj relaciji u isto vreme već postoji.");
    }
    if (t.status === "full") {
      await supabase.from("trips").update({ status: "full" }).eq("route_id", t.routeId).eq("departure_at", departure.toISOString());
    }
    refresh();
    return ok(undefined, "Polazak je kreiran.");
  });
}

export async function createRecurringTrips(input: RecurringTripInput) {
  return runAdminAction<{ created: number; skippedExisting: number; skippedBlocked: number }>(
    { manager: true },
    async ({ supabase }) => {
      const parsed = recurringSchema.safeParse(input);
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
      const r = parsed.data;
      if (r.endDate < r.startDate) return fail("Krajnji datum mora biti posle početnog.");

      const settings = await loadSettings(supabase);
      const tz = settings.timezone;
      const today = toZoned(new Date(), tz).date;
      const weekdays = new Set(r.weekdays);
      const times = [...new Set(r.times)].sort();

      const { data: blockedRows } = await supabase
        .from("blocked_dates")
        .select("blocked_on")
        .gte("blocked_on", r.startDate)
        .lte("blocked_on", r.endDate)
        .or(`route_id.is.null,route_id.eq.${r.routeId}`);
      const blocked = new Set((blockedRows ?? []).map((b) => b.blocked_on as string));

      const recurrenceId = uuid();
      const rows: ReturnType<typeof tripRow>[] = [];
      let skippedBlocked = 0;
      let key = r.startDate;
      for (let guard = 0; key <= r.endDate && guard < 400; guard++, key = addDaysToKey(key, 1)) {
        if (key < today || !weekdays.has(weekdayOfKey(key))) continue;
        if (blocked.has(key)) {
          skippedBlocked += times.length;
          continue;
        }
        for (const time of times) {
          const dep = zonedToUtc(key, time, tz);
          if (dep.getTime() < Date.now()) continue;
          const arrival =
            r.arrivalOffsetMinutes !== null ? new Date(dep.getTime() + r.arrivalOffsetMinutes * 60_000).toISOString() : null;
          rows.push(tripRow(r, dep, arrival, recurrenceId));
        }
      }
      if (key <= r.endDate) return fail("Period je predugačak. Podelite ga na manje delove (najviše ~1 godina).");
      if (rows.length === 0) {
        return fail(skippedBlocked > 0 ? "Svi izabrani dani su blokirani." : "Nijedan datum ne odgovara izabranim danima u nedelji.");
      }
      if (rows.length > 400) return fail("Previše polazaka odjednom (najviše 400). Skratite period.");

      const { data, error } = await supabase.rpc("create_trips", { p_trips: rows });
      if (error) throw error;
      const result = data as { created: number; skipped: number };
      refresh();
      return ok(
        { created: result.created, skippedExisting: result.skipped, skippedBlocked },
        result.created > 0
          ? `Kreirano polazaka: ${result.created}.${result.skipped ? ` Preskočeno (već postoje): ${result.skipped}.` : ""}${skippedBlocked ? ` Preskočeno (blokirani dani): ${skippedBlocked}.` : ""}`
          : "Svi polasci iz ovog rasporeda već postoje — ništa nije dodato.",
      );
    },
  );
}

const updateSchema = singleSchema.extend({ id: z.uuid() });
export type UpdateTripInput = z.input<typeof updateSchema>;

export async function updateTrip(input: UpdateTripInput, acknowledgeBookings: boolean) {
  return runAdminAction<{ affected: number }>({ manager: true }, async ({ supabase }) => {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const t = parsed.data;
    const settings = await loadSettings(supabase);
    const departure = zonedToUtc(t.date, t.time, settings.timezone);

    const { data, error } = await supabase.rpc("update_trip", {
      p_trip_id: t.id,
      p: {
        departure_at: departure.toISOString(),
        arrival_at: buildArrival(t.date, t.time, t.arrivalTime, settings.timezone),
        capacity: t.capacity,
        price_override: t.priceOverride,
        vehicle_id: t.vehicleId,
        driver_id: t.driverId,
        notes: t.notes,
        status: t.status,
      },
      p_ack_bookings: acknowledgeBookings,
    });
    if (error) {
      if (error.code === "23505") return fail("Polazak na ovoj relaciji u isto vreme već postoji.");
      throw error;
    }
    const affected = (data as { affected_bookings: number }).affected_bookings;
    refresh();
    return ok(
      { affected },
      affected > 0
        ? `Polazak je izmenjen. Pogođenih rezervacija: ${affected} — obavestite putnike ako se promenilo vreme.`
        : "Polazak je izmenjen.",
    );
  });
}

export type AffectedBooking = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  departure: string;
};

export async function cancelTrip(id: string, reason: string, cancelBookings: boolean) {
  return runAdminAction<{ affected: AffectedBooking[]; cancelled: boolean }>({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");

    const { data: before } = await supabase
      .from("bookings")
      .select("id,reference,customer_name,customer_phone,departure_at")
      .in("status", ["pending", "confirmed"])
      .or(`trip_id.eq.${id},return_trip_id.eq.${id}`);

    const { error } = await supabase.rpc("cancel_trip", {
      p_trip_id: id,
      p_reason: reason.slice(0, 300) || null,
      p_cancel_bookings: cancelBookings,
    });
    if (error) throw error;

    const affected: AffectedBooking[] = (before ?? []).map((b) => ({
      id: b.id,
      reference: b.reference,
      name: b.customer_name,
      phone: b.customer_phone,
      departure: b.departure_at,
    }));

    if (cancelBookings && affected.length > 0) {
      // Customers with an e-mail are told automatically; everyone else is listed for a manual WhatsApp message.
      after(async () => {
        for (const b of affected) await notifyBooking(b.id, "cancelled", { customerOnly: true });
      });
    }
    refresh();
    return ok(
      { affected, cancelled: cancelBookings },
      affected.length === 0
        ? "Polazak je otkazan."
        : cancelBookings
          ? `Polazak i ${affected.length} rezervacija su otkazani. Obavestite putnike.`
          : `Polazak je otkazan. ${affected.length} rezervacija i dalje čeka vašu odluku — kontaktirajte putnike.`,
    );
  });
}

export async function setTripFull(id: string, full: boolean) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase
      .from("trips")
      .update({ status: full ? "full" : "scheduled" })
      .eq("id", id)
      .neq("status", "cancelled");
    if (error) throw error;
    refresh();
    return ok(undefined, full ? "Polazak je označen kao popunjen." : "Polazak je ponovo otvoren za rezervacije.");
  });
}

export async function duplicateTrip(id: string, dates: string[]) {
  return runAdminAction<{ created: number; skipped: number }>({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const list = z.array(dateStr).min(1, "Izaberite bar jedan datum.").max(60, "Najviše 60 datuma.").safeParse([...new Set(dates)]);
    if (!list.success) return fail(list.error.issues[0]?.message ?? "Neispravni datumi.");

    const { data: trip, error: tripError } = await supabase.from("trips").select("*").eq("id", id).single();
    if (tripError || !trip) return fail("Polazak nije pronađen.");
    const settings = await loadSettings(supabase);
    const tz = settings.timezone;
    const source = toZoned(trip.departure_at, tz);
    const duration = trip.arrival_at ? Date.parse(trip.arrival_at) - Date.parse(trip.departure_at) : null;

    const rows = list.data
      .map((date) => zonedToUtc(date, source.time, tz))
      .filter((dep) => dep.getTime() > Date.now())
      .map((dep) => ({
        route_id: trip.route_id,
        departure_at: dep.toISOString(),
        arrival_at: duration ? new Date(dep.getTime() + duration).toISOString() : null,
        capacity: trip.capacity,
        price_override: trip.price_override,
        vehicle_id: trip.vehicle_id,
        driver_id: trip.driver_id,
        notes: trip.notes,
        recurrence_id: null,
      }));
    if (rows.length === 0) return fail("Izabrani datumi su u prošlosti.");

    const { data, error } = await supabase.rpc("create_trips", { p_trips: rows });
    if (error) throw error;
    const result = data as { created: number; skipped: number };
    refresh();
    return ok(
      result,
      result.created > 0
        ? `Dupliran polazak: ${result.created}.${result.skipped ? ` Već postoje: ${result.skipped}.` : ""}`
        : "Polasci na izabrane datume već postoje.",
    );
  });
}

export async function blockDate(date: string, routeId: string | null, reason: string) {
  return runAdminAction<{ activeBookings: number }>({ manager: true }, async ({ supabase }) => {
    if (!DATE_RE.test(date)) return fail("Neispravan datum.");
    if (routeId !== null && !z.uuid().safeParse(routeId).success) return fail("Neispravna relacija.");
    const { error } = await supabase
      .from("blocked_dates")
      .insert({ blocked_on: date, route_id: routeId, reason: reason.trim().slice(0, 200) });
    if (error) {
      if (error.code === "23505") return fail("Taj datum je već blokiran.");
      throw error;
    }

    // Existing reservations are NOT touched automatically — tell the admin how many need attention.
    const settings = await loadSettings(supabase);
    const start = zonedToUtc(date, "00:00", settings.timezone).toISOString();
    const end = zonedToUtc(addDaysToKey(date, 1), "00:00", settings.timezone).toISOString();
    let query = supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "confirmed"])
      .gte("departure_at", start)
      .lt("departure_at", end);
    if (routeId) query = query.eq("route_id", routeId);
    const { count } = await query;
    refresh();
    return ok(
      { activeBookings: count ?? 0 },
      (count ?? 0) > 0
        ? `Datum je blokiran za nove rezervacije. Postojećih rezervacija tog dana: ${count} — kontaktirajte putnike.`
        : "Datum je blokiran za nove rezervacije.",
    );
  });
}

export async function unblockDate(id: string) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) throw error;
    refresh();
    return ok(undefined, "Datum je ponovo otvoren za rezervacije.");
  });
}
