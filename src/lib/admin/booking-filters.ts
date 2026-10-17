import "server-only";
import { addDaysToKey, DATE_RE, zonedToUtc } from "@/lib/reservations/time";

export type BookingFilters = {
  q?: string;
  status?: string;
  route?: string;
  trip?: string;
  from?: string;
  to?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["pending", "confirmed", "cancelled", "completed"]);

/** Applies the (validated) filters to a bookings query. Shared by the table and the CSV export. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyBookingFilters<Q extends { or: any; eq: any; gte: any; lt: any }>(query: Q, f: BookingFilters, tz: string): Q {
  let q = query;
  const search = (f.q ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
  if (search) q = q.or(`reference.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
  if (f.status && STATUSES.has(f.status)) q = q.eq("status", f.status);
  if (f.route && UUID_RE.test(f.route)) q = q.eq("route_id", f.route);
  if (f.trip && UUID_RE.test(f.trip)) q = q.or(`trip_id.eq.${f.trip},return_trip_id.eq.${f.trip}`);
  if (f.from && DATE_RE.test(f.from)) q = q.gte("departure_at", zonedToUtc(f.from, "00:00", tz).toISOString());
  if (f.to && DATE_RE.test(f.to)) q = q.lt("departure_at", zonedToUtc(addDaysToKey(f.to, 1), "00:00", tz).toISOString());
  return q;
}
