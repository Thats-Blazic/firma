import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";
import { computeQuote, normalizeFees, type Quote } from "@/lib/reservations/pricing";
import {
  daysInMonth,
  monthBounds,
  monthKey,
  toZoned,
} from "@/lib/reservations/time";
import type {
  BlockedDateRow,
  BookingRow,
  DestinationRow,
  PricingMode,
  RouteRow,
  Settings,
  TripAvailabilityRow,
  TripRow,
} from "@/lib/reservations/types";

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  company_name: "Adriatic Trans",
  company_phone: "",
  company_email: "",
  company_address: "",
  admin_phone: "",
  admin_email: "",
  confirmation_mode: "manual",
  min_advance_hours: 12,
  max_booking_window_days: 180,
  default_capacity: 4,
  currency: "EUR",
  timezone: "Europe/Belgrade",
  cancellation_policy: "",
  notify_admin_whatsapp: true,
  notify_admin_email: true,
  notify_customer_email: true,
  updated_at: new Date(0).toISOString(),
};

export const getSettings = cache(async (): Promise<Settings> => {
  const { data } = await createServiceClient().from("settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as Settings;
});

/** Settings that are safe to show to the public (no admin phone / e-mail). */
export type PublicSettings = Pick<
  Settings,
  | "company_name"
  | "company_phone"
  | "currency"
  | "timezone"
  | "min_advance_hours"
  | "max_booking_window_days"
  | "cancellation_policy"
  | "confirmation_mode"
  | "default_capacity"
>;

export type PublicLocation = Pick<
  DestinationRow,
  "id" | "name" | "country" | "description" | "image_url" | "is_pickup" | "is_destination"
>;

export type PublicRoute = Pick<
  RouteRow,
  "id" | "origin_id" | "destination_id" | "pricing_mode" | "base_price" | "return_price" | "allow_return"
> & { has_return: boolean; reverse_route_id: string | null };

export type BookingOptions = {
  settings: PublicSettings;
  locations: PublicLocation[];
  routes: PublicRoute[];
};

export async function getBookingOptions(): Promise<BookingOptions> {
  const db = createServiceClient();
  const settings = await getSettings();
  const [dest, routes] = await Promise.all([
    db
      .from("destinations")
      .select("id,name,country,description,image_url,is_pickup,is_destination")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    db
      .from("routes")
      .select("id,origin_id,destination_id,pricing_mode,base_price,return_price,allow_return")
      .eq("is_active", true),
  ]);
  if (dest.error) throw dest.error;
  if (routes.error) throw routes.error;

  const locations = (dest.data ?? []) as PublicLocation[];
  const byId = new Map(locations.map((l) => [l.id, l]));
  const live = ((routes.data ?? []) as RouteRow[]).filter((r) => {
    const o = byId.get(r.origin_id);
    const d = byId.get(r.destination_id);
    return Boolean(o?.is_pickup && d?.is_destination);
  });
  const key = (a: string, b: string) => `${a}>${b}`;
  const reverse = new Map(((routes.data ?? []) as RouteRow[]).map((r) => [key(r.origin_id, r.destination_id), r]));

  return {
    settings: {
      company_name: settings.company_name,
      company_phone: settings.company_phone,
      currency: settings.currency,
      timezone: settings.timezone,
      min_advance_hours: settings.min_advance_hours,
      max_booking_window_days: settings.max_booking_window_days,
      cancellation_policy: settings.cancellation_policy,
      confirmation_mode: settings.confirmation_mode,
      default_capacity: settings.default_capacity,
    },
    locations,
    routes: live.map((r) => {
      const back = reverse.get(key(r.destination_id, r.origin_id));
      // `byId` only contains active locations, and only active routes are fetched.
      const backLive = Boolean(back && byId.has(back.origin_id) && byId.has(back.destination_id));
      return {
        id: r.id,
        origin_id: r.origin_id,
        destination_id: r.destination_id,
        pricing_mode: r.pricing_mode,
        base_price: Number(r.base_price),
        return_price: r.return_price === null ? null : Number(r.return_price),
        allow_return: r.allow_return,
        has_return: r.allow_return && backLive,
        reverse_route_id: backLive && back ? back.id : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
//  Upcoming bookable trips (the "slobodni termini" list on the home page)
// ---------------------------------------------------------------------------
export type UpcomingTrip = {
  id: string;
  routeId: string;
  originName: string;
  destinationName: string;
  destinationCountry: string;
  imageUrl: string | null;
  departureAt: string;
  date: string;
  time: string;
  /** Planned arrival (local HH:MM), when the admin entered one. */
  arrivalTime: string | null;
  /** Vehicle name set on the trip in the admin (e.g. "Mercedes Vito"). */
  vehicleName: string | null;
  /** Free-text description written in the admin; shown on the card. */
  note: string;
  remaining: number;
  capacity: number;
  unitPrice: number;
  pricingMode: PricingMode;
  hasReturn: boolean;
  reverseRouteId: string | null;
};

/**
 * Real, admin-created trips that can be booked right now: scheduled, seats left,
 * inside the booking window and not on a blocked date.
 */
export async function getUpcomingTrips(
  opts: { routeId?: string; notBefore?: string | null; isReturn?: boolean; limit?: number } = {},
): Promise<{ settings: PublicSettings; trips: UpcomingTrip[] }> {
  const { settings, locations, routes } = await getBookingOptions();
  const live = opts.routeId ? routes.filter((r) => r.id === opts.routeId) : routes;
  if (live.length === 0) return { settings, trips: [] };

  const db = createServiceClient();
  const { earliest, latest } = bookingWindow(settings);
  // A return leg only has to be in the future; the minimum-advance rule applies to the outbound trip.
  let lower = (opts.isReturn ? new Date() : earliest).getTime();
  if (opts.notBefore) lower = Math.max(lower, Date.parse(opts.notBefore) + 1);

  const [tripsRes, blockedRes] = await Promise.all([
    db
      .from("trip_availability")
      .select("*")
      .in("route_id", live.map((r) => r.id))
      .eq("status", "scheduled")
      .gt("remaining", 0)
      .gte("departure_at", new Date(lower).toISOString())
      .lte("departure_at", latest.toISOString())
      .order("departure_at")
      .limit(300),
    db
      .from("blocked_dates")
      .select("blocked_on,route_id")
      .gte("blocked_on", toZoned(new Date(lower), settings.timezone).date)
      .lte("blocked_on", toZoned(latest, settings.timezone).date),
  ]);
  if (tripsRes.error) throw tripsRes.error;
  if (blockedRes.error) throw blockedRes.error;

  const blockedAll = new Set<string>();
  const blockedByRoute = new Set<string>();
  for (const b of (blockedRes.data ?? []) as Pick<BlockedDateRow, "blocked_on" | "route_id">[]) {
    if (b.route_id) blockedByRoute.add(`${b.route_id}|${b.blocked_on}`);
    else blockedAll.add(b.blocked_on);
  }

  const tripRows = (tripsRes.data ?? []) as TripAvailabilityRow[];
  const vehicleIds = [...new Set(tripRows.map((t) => t.vehicle_id).filter((v): v is string => Boolean(v)))];
  const vehicleNames = new Map<string, string>();
  if (vehicleIds.length > 0) {
    const { data: vehicles, error } = await db.from("vehicles").select("id,name").in("id", vehicleIds);
    if (error) throw error;
    for (const v of (vehicles ?? []) as { id: string; name: string }[]) vehicleNames.set(v.id, v.name);
  }

  const routeById = new Map(live.map((r) => [r.id, r]));
  const locById = new Map(locations.map((l) => [l.id, l]));
  const out: UpcomingTrip[] = [];
  for (const t of tripRows) {
    const route = routeById.get(t.route_id);
    if (!route) continue;
    const z = toZoned(t.departure_at, settings.timezone);
    if (blockedAll.has(z.date) || blockedByRoute.has(`${t.route_id}|${z.date}`)) continue;
    const origin = locById.get(route.origin_id);
    const dest = locById.get(route.destination_id);
    if (!origin || !dest) continue;
    out.push({
      id: t.id,
      routeId: route.id,
      originName: origin.name,
      destinationName: dest.name,
      destinationCountry: dest.country,
      imageUrl: dest.image_url,
      departureAt: t.departure_at,
      date: z.date,
      time: z.time,
      arrivalTime: t.arrival_at ? toZoned(t.arrival_at, settings.timezone).time : null,
      vehicleName: t.vehicle_id ? (vehicleNames.get(t.vehicle_id) ?? null) : null,
      note: (t.notes ?? "").trim(),
      remaining: t.remaining,
      capacity: t.capacity,
      unitPrice: Number(t.price_override ?? route.base_price),
      pricingMode: route.pricing_mode,
      hasReturn: route.has_return,
      reverseRouteId: route.reverse_route_id,
    });
    if (out.length >= (opts.limit ?? 36)) break;
  }
  return { settings, trips: out };
}

export type DayTrip = { id: string; time: string; remaining: number; capacity: number; unitPrice: number };
export type DayInfo = { state: "available" | "full"; trips: DayTrip[] };
export type MonthAvailability = {
  month: string;
  days: Record<string, DayInfo>;
  blocked: string[];
};

/** Bookable window as UTC instants. */
export function bookingWindow(settings: Pick<Settings, "min_advance_hours" | "max_booking_window_days">, now = new Date()) {
  return {
    earliest: new Date(now.getTime() + settings.min_advance_hours * 3_600_000),
    latest: new Date(now.getTime() + settings.max_booking_window_days * 86_400_000),
  };
}

export async function getMonthAvailability(input: {
  routeId: string;
  year: number;
  monthIndex: number;
  /** Only trips departing strictly after this instant (used for the return leg). */
  notBefore?: string | null;
}): Promise<MonthAvailability> {
  const db = createServiceClient();
  const settings = await getSettings();
  const tz = settings.timezone;
  const { start, end } = monthBounds(input.year, input.monthIndex, tz);
  const { earliest, latest } = bookingWindow(settings);
  const month = monthKey(input.year, input.monthIndex);

  const { data: route } = await db.from("routes").select("id,is_active").eq("id", input.routeId).maybeSingle();
  if (!route?.is_active) return { month, days: {}, blocked: [] };

  const firstKey = `${month}-01`;
  const lastKey = `${month}-${String(daysInMonth(input.year, input.monthIndex)).padStart(2, "0")}`;

  const [tripsRes, blockedRes] = await Promise.all([
    db
      .from("trip_availability")
      .select("id,departure_at,capacity,status,price_override,remaining,route_id")
      .eq("route_id", input.routeId)
      .neq("status", "cancelled")
      .gte("departure_at", start.toISOString())
      .lt("departure_at", end.toISOString())
      .order("departure_at"),
    db
      .from("blocked_dates")
      .select("blocked_on,route_id")
      .gte("blocked_on", firstKey)
      .lte("blocked_on", lastKey)
      .or(`route_id.is.null,route_id.eq.${input.routeId}`),
  ]);
  if (tripsRes.error) throw tripsRes.error;
  if (blockedRes.error) throw blockedRes.error;

  const { data: routeRow } = await db.from("routes").select("base_price").eq("id", input.routeId).single();
  const base = Number(routeRow?.base_price ?? 0);
  const blocked = new Set(((blockedRes.data ?? []) as Pick<BlockedDateRow, "blocked_on">[]).map((b) => b.blocked_on));
  const notBefore = input.notBefore ? Date.parse(input.notBefore) : null;

  const days: Record<string, DayInfo> = {};
  for (const t of (tripsRes.data ?? []) as TripAvailabilityRow[]) {
    const dep = Date.parse(t.departure_at);
    if (dep < earliest.getTime() || dep > latest.getTime()) continue;
    if (notBefore !== null && dep <= notBefore) continue;
    const z = toZoned(t.departure_at, tz);
    if (blocked.has(z.date)) continue;
    const day = (days[z.date] ??= { state: "full", trips: [] });
    if (t.status === "scheduled" && t.remaining > 0) {
      day.state = "available";
      day.trips.push({
        id: t.id,
        time: z.time,
        remaining: t.remaining,
        capacity: t.capacity,
        unitPrice: Number(t.price_override ?? base),
      });
    }
  }
  return { month, days, blocked: [...blocked].sort() };
}

// ---------------------------------------------------------------------------
//  Quote + bookability checks (shared by the quote endpoint and booking creation)
// ---------------------------------------------------------------------------

export type QuoteContext = {
  quote: Quote;
  settings: Settings;
  trip: TripRow;
  route: RouteRow;
  returnTrip: TripRow | null;
  returnRoute: RouteRow | null;
  versions: { route: string; trip: string; return_trip?: string; return_route?: string };
};

export type QuoteResult =
  | { ok: true; ctx: QuoteContext }
  | { ok: false; code: string };

export async function buildQuote(input: {
  tripId: string;
  returnTripId?: string | null;
  passengers: number;
}): Promise<QuoteResult> {
  const db = createServiceClient();
  const settings = await getSettings();
  const { earliest, latest } = bookingWindow(settings);

  const ids = [input.tripId, ...(input.returnTripId ? [input.returnTripId] : [])];
  const { data: trips, error } = await db.from("trip_availability").select("*").in("id", ids);
  if (error) throw error;
  const trip = (trips ?? []).find((t) => t.id === input.tripId) as TripAvailabilityRow | undefined;
  const returnTrip = (trips ?? []).find((t) => t.id === input.returnTripId) as TripAvailabilityRow | undefined;
  if (!trip) return { ok: false, code: "TRIP_NOT_FOUND" };
  if (input.returnTripId && !returnTrip) return { ok: false, code: "TRIP_NOT_FOUND" };

  const routeIds = [trip.route_id, ...(returnTrip ? [returnTrip.route_id] : [])];
  const { data: routes, error: routeError } = await db.from("routes").select("*").in("id", routeIds);
  if (routeError) throw routeError;
  const route = (routes ?? []).find((r) => r.id === trip.route_id) as RouteRow | undefined;
  const returnRoute = returnTrip
    ? ((routes ?? []).find((r) => r.id === returnTrip.route_id) as RouteRow | undefined)
    : undefined;
  if (!route || !route.is_active) return { ok: false, code: "ROUTE_INACTIVE" };

  const checkTrip = async (t: TripAvailabilityRow, isReturn: boolean): Promise<string | null> => {
    if (t.status === "cancelled") return "TRIP_CANCELLED";
    if (t.status === "full") return "TRIP_FULL";
    const dep = Date.parse(t.departure_at);
    if (!isReturn && dep < earliest.getTime()) return "TOO_SOON";
    if (dep > latest.getTime()) return "TOO_FAR";
    const local = toZoned(t.departure_at, settings.timezone).date;
    const { data: blocked } = await db
      .from("blocked_dates")
      .select("id")
      .eq("blocked_on", local)
      .or(`route_id.is.null,route_id.eq.${t.route_id}`)
      .limit(1);
    if ((blocked ?? []).length > 0) return "DATE_BLOCKED";
    if (t.remaining < input.passengers) return t.remaining <= 0 ? "TRIP_FULL" : "NOT_ENOUGH_SEATS";
    return null;
  };

  const outboundError = await checkTrip(trip, false);
  if (outboundError) return { ok: false, code: outboundError };

  if (returnTrip) {
    if (
      !returnRoute ||
      !returnRoute.is_active ||
      !route.allow_return ||
      returnRoute.origin_id !== route.destination_id ||
      returnRoute.destination_id !== route.origin_id
    ) {
      return { ok: false, code: "INVALID_RETURN_TRIP" };
    }
    if (Date.parse(returnTrip.departure_at) <= Date.parse(trip.departure_at)) {
      return { ok: false, code: "RETURN_BEFORE_DEPARTURE" };
    }
    const returnError = await checkTrip(returnTrip, true);
    if (returnError) return { ok: false, code: returnError };
  }

  const cleanRoute = { ...route, base_price: Number(route.base_price), fees: normalizeFees(route.fees) } as RouteRow;
  const quote = computeQuote({
    currency: settings.currency,
    route: cleanRoute,
    trip: trip as TripRow,
    returnTrip: (returnTrip as TripRow | undefined) ?? null,
    returnRoute: returnRoute ? ({ ...returnRoute, base_price: Number(returnRoute.base_price) } as RouteRow) : null,
    passengers: input.passengers,
  });

  return {
    ok: true,
    ctx: {
      quote,
      settings,
      trip: trip as TripRow,
      route: cleanRoute,
      returnTrip: (returnTrip as TripRow | undefined) ?? null,
      returnRoute: returnRoute ?? null,
      versions: {
        route: route.updated_at,
        trip: trip.updated_at,
        ...(returnTrip && returnRoute ? { return_trip: returnTrip.updated_at, return_route: returnRoute.updated_at } : {}),
      },
    },
  };
}

// ---------------------------------------------------------------------------
//  Confirmation page data: deliberately limited (no phone, e-mail or internal notes).
// ---------------------------------------------------------------------------
export type PublicBooking = Pick<
  BookingRow,
  | "reference"
  | "status"
  | "origin_name"
  | "destination_name"
  | "departure_at"
  | "return_departure_at"
  | "passengers"
  | "luggage"
  | "total_price"
  | "currency"
  | "price_breakdown"
  | "created_at"
> & { first_name: string };

export async function getPublicBooking(reference: string): Promise<PublicBooking | null> {
  if (!/^AT-[A-Z0-9]{6}$/.test(reference)) return null;
  const { data } = await createServiceClient()
    .from("bookings")
    .select(
      "reference,status,origin_name,destination_name,departure_at,return_departure_at,passengers,luggage,total_price,currency,price_breakdown,created_at,customer_name",
    )
    .eq("reference", reference)
    .maybeSingle();
  if (!data) return null;
  const { customer_name, ...rest } = data as BookingRow;
  return { ...(rest as Omit<PublicBooking, "first_name">), total_price: Number(data.total_price), first_name: customer_name.trim().split(/\s+/)[0] };
}