/** Row types mirroring supabase/migrations/0001_init.sql (numeric columns arrive as numbers). */

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PricingMode = "per_person" | "per_vehicle";
export type TripStatus = "scheduled" | "full" | "cancelled";
export type AdminRole = "owner" | "admin" | "staff";

export type Fee = { label: string; amount: number; per: "booking" | "person" };

export type Settings = {
  id: number;
  company_name: string;
  company_phone: string;
  company_email: string;
  company_address: string;
  admin_phone: string;
  admin_email: string;
  confirmation_mode: "auto" | "manual";
  min_advance_hours: number;
  max_booking_window_days: number;
  default_capacity: number;
  currency: string;
  timezone: string;
  cancellation_policy: string;
  notify_admin_whatsapp: boolean;
  notify_admin_email: boolean;
  notify_customer_email: boolean;
  updated_at: string;
};

export type DestinationRow = {
  id: string;
  name: string;
  slug: string;
  country: string;
  description: string;
  image_url: string | null;
  is_pickup: boolean;
  is_destination: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RouteRow = {
  id: string;
  origin_id: string;
  destination_id: string;
  pricing_mode: PricingMode;
  base_price: number;
  return_price: number | null;
  allow_return: boolean;
  fees: Fee[];
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VehicleRow = { id: string; name: string; plate: string; capacity: number; is_active: boolean };
export type DriverRow = { id: string; name: string; phone: string; is_active: boolean };

export type TripRow = {
  id: string;
  route_id: string;
  departure_at: string;
  arrival_at: string | null;
  capacity: number;
  status: TripStatus;
  price_override: number | null;
  vehicle_id: string | null;
  driver_id: string | null;
  notes: string;
  recurrence_id: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TripAvailabilityRow = TripRow & { booked: number; remaining: number };

export type BlockedDateRow = { id: string; blocked_on: string; route_id: string | null; reason: string };

export type QuoteLine = {
  kind: "outbound" | "return" | "fee";
  label: string;
  detail?: string;
  amount: number;
};

export type BookingRow = {
  id: string;
  reference: string;
  status: BookingStatus;
  route_id: string;
  trip_id: string;
  return_trip_id: string | null;
  passengers: number;
  luggage: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string;
  internal_notes: string;
  currency: string;
  pricing_mode: PricingMode;
  unit_price: number;
  return_unit_price: number | null;
  total_price: number;
  price_breakdown: QuoteLine[];
  origin_name: string;
  destination_name: string;
  departure_at: string;
  return_departure_at: string | null;
  source: string;
  cancel_reason: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  cancelled: "Otkazano",
  completed: "Završeno",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: "Zakazan",
  full: "Popunjen",
  cancelled: "Otkazan",
};
