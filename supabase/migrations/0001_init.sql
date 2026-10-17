-- ============================================================================
--  Adrirora Travel — booking system schema
--  Run once in the Supabase SQL editor (or with `supabase db push`).
--  Safe to read top to bottom: tables → helpers → triggers → views → RPC → RLS.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
--  Business settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'Adrirora Travel',
  company_phone text not null default '',
  company_email text not null default '',
  company_address text not null default '',
  -- Digits only, international format (e.g. 381612378859). Used for WhatsApp notifications.
  admin_phone text not null default '',
  admin_email text not null default '',
  confirmation_mode text not null default 'manual' check (confirmation_mode in ('auto', 'manual')),
  min_advance_hours integer not null default 12 check (min_advance_hours >= 0 and min_advance_hours <= 24 * 90),
  max_booking_window_days integer not null default 180 check (max_booking_window_days between 1 and 730),
  default_capacity integer not null default 4 check (default_capacity between 1 and 60),
  currency char(3) not null default 'EUR',
  timezone text not null default 'Europe/Belgrade',
  cancellation_policy text not null default '',
  notify_admin_whatsapp boolean not null default true,
  notify_admin_email boolean not null default true,
  notify_customer_email boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Administrators (linked to Supabase Auth users; passwords live in auth.users, hashed)
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- owner/admin may change configuration; staff may only work with bookings.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
--  Destinations / pickup locations
-- ---------------------------------------------------------------------------
create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique,
  country text not null default '',
  description text not null default '',
  image_url text,
  is_pickup boolean not null default true,
  is_destination boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index destinations_name_unique on public.destinations (lower(btrim(name)));
create trigger destinations_touch before update on public.destinations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Routes and pricing
--    pricing_mode: per_person  → price × passengers
--                  per_vehicle → one fixed price for the private ride
--    return_price: price of the return leg (same pricing_mode). NULL = use the
--                  reverse route's own price.
--    fees: [{ "label": "Noćna tarifa", "amount": 5, "per": "booking" | "person" }]
-- ---------------------------------------------------------------------------
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  origin_id uuid not null references public.destinations (id) on delete restrict,
  destination_id uuid not null references public.destinations (id) on delete restrict,
  pricing_mode text not null default 'per_person' check (pricing_mode in ('per_person', 'per_vehicle')),
  base_price numeric(10, 2) not null check (base_price >= 0),
  return_price numeric(10, 2) check (return_price is null or return_price >= 0),
  allow_return boolean not null default true,
  fees jsonb not null default '[]'::jsonb check (jsonb_typeof(fees) = 'array'),
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_distinct_ends check (origin_id <> destination_id),
  constraint routes_unique unique (origin_id, destination_id)
);
create trigger routes_touch before update on public.routes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Vehicles and drivers (optional)
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  plate text not null default '',
  capacity integer not null default 4 check (capacity between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Trips (scheduled departures)
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete restrict,
  departure_at timestamptz not null,
  arrival_at timestamptz,
  capacity integer not null check (capacity between 1 and 100),
  status text not null default 'scheduled' check (status in ('scheduled', 'full', 'cancelled')),
  price_override numeric(10, 2) check (price_override is null or price_override >= 0),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  notes text not null default '',
  recurrence_id uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_arrival_after_departure check (arrival_at is null or arrival_at > departure_at)
);
-- One live trip per route and departure moment: recurring creation can never duplicate.
create unique index trips_route_departure_unique
  on public.trips (route_id, departure_at) where status <> 'cancelled';
create index trips_departure_idx on public.trips (departure_at);
create index trips_route_departure_idx on public.trips (route_id, departure_at);
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Blocked dates (route_id NULL = every route)
-- ---------------------------------------------------------------------------
create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_on date not null,
  route_id uuid references public.routes (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create unique index blocked_dates_unique
  on public.blocked_dates (blocked_on, coalesce(route_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------------
--  Bookings (price and trip details are SNAPSHOTS and never change afterwards)
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  route_id uuid not null references public.routes (id) on delete restrict,
  trip_id uuid not null references public.trips (id) on delete restrict,
  return_trip_id uuid references public.trips (id) on delete restrict,
  passengers integer not null check (passengers between 1 and 60),
  luggage integer not null default 0 check (luggage between 0 and 60),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 100),
  customer_phone text not null check (char_length(customer_phone) between 7 and 24),
  customer_email text check (customer_email is null or char_length(customer_email) <= 160),
  notes text not null default '',
  internal_notes text not null default '',
  -- price snapshot
  currency char(3) not null,
  pricing_mode text not null check (pricing_mode in ('per_person', 'per_vehicle')),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  return_unit_price numeric(10, 2) check (return_unit_price is null or return_unit_price >= 0),
  total_price numeric(10, 2) not null check (total_price >= 0),
  price_breakdown jsonb not null default '[]'::jsonb,
  -- trip snapshot
  origin_name text not null,
  destination_name text not null,
  departure_at timestamptz not null,
  return_departure_at timestamptz,
  idempotency_key uuid not null unique,
  source text not null default 'web',
  cancel_reason text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_return_differs check (return_trip_id is null or return_trip_id <> trip_id)
);
create index bookings_trip_idx on public.bookings (trip_id);
create index bookings_return_trip_idx on public.bookings (return_trip_id) where return_trip_id is not null;
create index bookings_status_idx on public.bookings (status);
create index bookings_created_idx on public.bookings (created_at desc);
create index bookings_route_idx on public.bookings (route_id);
create index bookings_phone_idx on public.bookings (customer_phone);
create index bookings_departure_idx on public.bookings (departure_at);
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Price / trip snapshots are immutable: later price changes can never alter an agreed booking.
create or replace function public.bookings_immutable_guard()
returns trigger
language plpgsql
as $$
begin
  if new.reference is distinct from old.reference
     or new.route_id is distinct from old.route_id
     or new.trip_id is distinct from old.trip_id
     or new.return_trip_id is distinct from old.return_trip_id
     or new.passengers is distinct from old.passengers
     or new.currency is distinct from old.currency
     or new.pricing_mode is distinct from old.pricing_mode
     or new.unit_price is distinct from old.unit_price
     or new.return_unit_price is distinct from old.return_unit_price
     or new.total_price is distinct from old.total_price
     or new.price_breakdown is distinct from old.price_breakdown
     or new.origin_name is distinct from old.origin_name
     or new.destination_name is distinct from old.destination_name
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'BOOKING_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger bookings_immutable before update on public.bookings
  for each row execute function public.bookings_immutable_guard();

-- ---------------------------------------------------------------------------
--  Notification log (so the admin can see what was really sent)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  recipient text not null check (recipient in ('admin', 'customer')),
  event text not null check (event in ('created', 'confirmed', 'cancelled')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index notifications_booking_idx on public.notifications (booking_id, created_at desc);

-- ---------------------------------------------------------------------------
--  Availability view: seats are derived from live bookings, never from a counter
--  that could drift. Pending and confirmed bookings both hold seats.
-- ---------------------------------------------------------------------------
create or replace function public.trip_booked_seats(p_trip_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(b.passengers), 0)::integer
  from public.bookings b
  where b.status in ('pending', 'confirmed', 'completed')
    and (b.trip_id = p_trip_id or b.return_trip_id = p_trip_id);
$$;

create or replace view public.trip_availability
with (security_invoker = true) as
select
  t.*,
  public.trip_booked_seats(t.id) as booked,
  greatest(t.capacity - public.trip_booked_seats(t.id), 0) as remaining
from public.trips t;

-- Capacity can never be set below the seats that are already booked.
create or replace function public.trips_capacity_guard()
returns trigger
language plpgsql
as $$
begin
  if new.capacity < old.capacity and new.capacity < public.trip_booked_seats(old.id) then
    raise exception 'CAPACITY_BELOW_BOOKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trips_capacity before update of capacity on public.trips
  for each row execute function public.trips_capacity_guard();

-- ---------------------------------------------------------------------------
--  RPC: create_booking  (called ONLY by the server with the service-role key)
--  Locks the trip rows, re-checks every rule, then inserts — all in one transaction,
--  so two customers can never take the same remaining seats.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s public.settings;
  v_trip public.trips;
  v_ret public.trips;
  v_route public.routes;
  v_ret_route public.routes;
  v_trip_id uuid := (p ->> 'trip_id')::uuid;
  v_ret_id uuid := nullif(p ->> 'return_trip_id', '')::uuid;
  v_pax integer := (p ->> 'passengers')::integer;
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_existing public.bookings;
  v_origin text;
  v_dest text;
  v_ref text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_status text;
  v_try integer := 0;
  v_booking public.bookings;
  v_local_date date;
begin
  select * into s from public.settings where id = 1;

  -- Duplicate submission (double click, retry, refresh): return the original booking.
  select * into v_existing from public.bookings where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference,
                              'status', v_existing.status, 'duplicate', true);
  end if;

  -- Same phone, same trip, within 10 minutes: treat as a duplicate as well.
  select * into v_existing from public.bookings
  where customer_phone = p ->> 'customer_phone'
    and trip_id = v_trip_id
    and passengers = v_pax
    and status in ('pending', 'confirmed')
    and created_at > now() - interval '10 minutes'
  limit 1;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference,
                              'status', v_existing.status, 'duplicate', true);
  end if;

  if v_pax is null or v_pax < 1 then raise exception 'INVALID_PASSENGERS' using errcode = 'P0001'; end if;
  if v_ret_id is not null and v_ret_id = v_trip_id then
    raise exception 'INVALID_RETURN_TRIP' using errcode = 'P0001';
  end if;

  -- Lock in a stable order (by id) so concurrent bookings cannot deadlock.
  perform 1 from public.trips
  where id in (v_trip_id, coalesce(v_ret_id, v_trip_id))
  order by id
  for update;

  select * into v_trip from public.trips where id = v_trip_id;
  if not found then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001'; end if;

  select * into v_route from public.routes where id = v_trip.route_id;
  if not found or not v_route.is_active then raise exception 'ROUTE_INACTIVE' using errcode = 'P0001'; end if;

  -- Price guard: the quote the server calculated must still match the live data.
  if (p -> 'versions' ->> 'route')::timestamptz is distinct from v_route.updated_at
     or (p -> 'versions' ->> 'trip')::timestamptz is distinct from v_trip.updated_at then
    raise exception 'PRICE_CHANGED' using errcode = 'P0001';
  end if;

  if v_trip.status = 'cancelled' then raise exception 'TRIP_CANCELLED' using errcode = 'P0001'; end if;
  if v_trip.status = 'full' then raise exception 'TRIP_FULL' using errcode = 'P0001'; end if;
  if v_trip.departure_at < now() + make_interval(hours => s.min_advance_hours) then
    raise exception 'TOO_SOON' using errcode = 'P0001';
  end if;
  if v_trip.departure_at > now() + make_interval(days => s.max_booking_window_days) then
    raise exception 'TOO_FAR' using errcode = 'P0001';
  end if;

  v_local_date := (v_trip.departure_at at time zone s.timezone)::date;
  if exists (
    select 1 from public.blocked_dates
    where blocked_on = v_local_date and (route_id is null or route_id = v_trip.route_id)
  ) then
    raise exception 'DATE_BLOCKED' using errcode = 'P0001';
  end if;

  if public.trip_booked_seats(v_trip.id) + v_pax > v_trip.capacity then
    raise exception 'NOT_ENOUGH_SEATS' using errcode = 'P0001';
  end if;

  if v_ret_id is not null then
    select * into v_ret from public.trips where id = v_ret_id;
    if not found then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001'; end if;
    select * into v_ret_route from public.routes where id = v_ret.route_id;
    if not found or not v_ret_route.is_active
       or v_ret_route.origin_id <> v_route.destination_id
       or v_ret_route.destination_id <> v_route.origin_id
       or not v_route.allow_return then
      raise exception 'INVALID_RETURN_TRIP' using errcode = 'P0001';
    end if;
    if (p -> 'versions' ->> 'return_trip')::timestamptz is distinct from v_ret.updated_at
       or (p -> 'versions' ->> 'return_route')::timestamptz is distinct from v_ret_route.updated_at then
      raise exception 'PRICE_CHANGED' using errcode = 'P0001';
    end if;
    if v_ret.status = 'cancelled' then raise exception 'TRIP_CANCELLED' using errcode = 'P0001'; end if;
    if v_ret.status = 'full' then raise exception 'TRIP_FULL' using errcode = 'P0001'; end if;
    if v_ret.departure_at <= v_trip.departure_at then
      raise exception 'RETURN_BEFORE_DEPARTURE' using errcode = 'P0001';
    end if;
    if v_ret.departure_at > now() + make_interval(days => s.max_booking_window_days) then
      raise exception 'TOO_FAR' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.blocked_dates
      where blocked_on = (v_ret.departure_at at time zone s.timezone)::date
        and (route_id is null or route_id = v_ret.route_id)
    ) then
      raise exception 'DATE_BLOCKED' using errcode = 'P0001';
    end if;
    if public.trip_booked_seats(v_ret.id) + v_pax > v_ret.capacity then
      raise exception 'NOT_ENOUGH_SEATS' using errcode = 'P0001';
    end if;
  end if;

  select name into v_origin from public.destinations where id = v_route.origin_id;
  select name into v_dest from public.destinations where id = v_route.destination_id;

  v_status := case when s.confirmation_mode = 'auto' then 'confirmed' else 'pending' end;

  -- Unique, unguessable reference: AT-XXXXXX (no 0/O/1/I/L).
  loop
    v_try := v_try + 1;
    v_ref := 'AT-' || (
      select string_agg(substr(v_alphabet, 1 + (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0) % 31), 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.bookings where reference = v_ref);
    if v_try > 20 then raise exception 'REFERENCE_FAILED' using errcode = 'P0001'; end if;
  end loop;

  insert into public.bookings (
    reference, status, route_id, trip_id, return_trip_id, passengers, luggage,
    customer_name, customer_phone, customer_email, notes,
    currency, pricing_mode, unit_price, return_unit_price, total_price, price_breakdown,
    origin_name, destination_name, departure_at, return_departure_at,
    idempotency_key, confirmed_at
  ) values (
    v_ref, v_status, v_route.id, v_trip.id, v_ret.id, v_pax, coalesce((p ->> 'luggage')::integer, 0),
    btrim(p ->> 'customer_name'), btrim(p ->> 'customer_phone'), nullif(btrim(p ->> 'customer_email'), ''),
    coalesce(btrim(p ->> 'notes'), ''),
    s.currency, v_route.pricing_mode, (p ->> 'unit_price')::numeric, nullif(p ->> 'return_unit_price', '')::numeric,
    (p ->> 'total_price')::numeric, coalesce(p -> 'price_breakdown', '[]'::jsonb),
    v_origin, v_dest, v_trip.departure_at, v_ret.departure_at,
    v_key, case when v_status = 'confirmed' then now() else null end
  )
  returning * into v_booking;

  return jsonb_build_object('id', v_booking.id, 'reference', v_booking.reference,
                            'status', v_booking.status, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------------
--  RPC: set_booking_status (admin)  — keeps availability consistent
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_status(p_booking_id uuid, p_status text, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  t public.trips;
  r public.trips;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_status not in ('pending', 'confirmed', 'cancelled', 'completed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into b from public.bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;

  perform 1 from public.trips
  where id in (b.trip_id, coalesce(b.return_trip_id, b.trip_id))
  order by id
  for update;

  -- Re-read after locking.
  select * into b from public.bookings where id = p_booking_id;
  if b.status = p_status then return b; end if;

  if not (
       (b.status = 'pending'   and p_status in ('confirmed', 'cancelled'))
    or (b.status = 'confirmed' and p_status in ('cancelled', 'completed'))
    or (b.status = 'cancelled' and p_status in ('pending', 'confirmed'))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- Re-activating a cancelled booking needs free seats and live trips again.
  if b.status = 'cancelled' and p_status in ('pending', 'confirmed') then
    select * into t from public.trips where id = b.trip_id;
    if t.status = 'cancelled' then raise exception 'TRIP_CANCELLED' using errcode = 'P0001'; end if;
    if public.trip_booked_seats(t.id) + b.passengers > t.capacity then
      raise exception 'NOT_ENOUGH_SEATS' using errcode = 'P0001';
    end if;
    if b.return_trip_id is not null then
      select * into r from public.trips where id = b.return_trip_id;
      if r.status = 'cancelled' then raise exception 'TRIP_CANCELLED' using errcode = 'P0001'; end if;
      if public.trip_booked_seats(r.id) + b.passengers > r.capacity then
        raise exception 'NOT_ENOUGH_SEATS' using errcode = 'P0001';
      end if;
    end if;
  end if;

  update public.bookings set
    status = p_status,
    confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else null end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancel_reason = case when p_status = 'cancelled' then nullif(btrim(coalesce(p_reason, '')), '') else null end
  where id = p_booking_id
  returning * into b;

  return b;
end;
$$;

-- ---------------------------------------------------------------------------
--  RPC: create_trips (admin) — single trip, duplicate and recurring creation.
--  Existing live trips (same route + departure) are skipped, never duplicated.
-- ---------------------------------------------------------------------------
create or replace function public.create_trips(p_trips jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_created integer;
  v_total integer;
begin
  if not public.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_total := jsonb_array_length(p_trips);
  if v_total = 0 then return jsonb_build_object('created', 0, 'skipped', 0); end if;
  if v_total > 400 then raise exception 'TOO_MANY_TRIPS' using errcode = 'P0001'; end if;

  with ins as (
    insert into public.trips (
      route_id, departure_at, arrival_at, capacity, price_override,
      vehicle_id, driver_id, notes, recurrence_id
    )
    select
      (x ->> 'route_id')::uuid,
      (x ->> 'departure_at')::timestamptz,
      nullif(x ->> 'arrival_at', '')::timestamptz,
      (x ->> 'capacity')::integer,
      nullif(x ->> 'price_override', '')::numeric,
      nullif(x ->> 'vehicle_id', '')::uuid,
      nullif(x ->> 'driver_id', '')::uuid,
      coalesce(x ->> 'notes', ''),
      nullif(x ->> 'recurrence_id', '')::uuid
    from jsonb_array_elements(p_trips) as x
    on conflict (route_id, departure_at) where status <> 'cancelled' do nothing
    returning 1
  )
  select count(*) into v_created from ins;

  return jsonb_build_object('created', v_created, 'skipped', v_total - v_created);
end;
$$;

-- ---------------------------------------------------------------------------
--  RPC: update_trip (admin) — keeps booking snapshots in sync when the time moves
-- ---------------------------------------------------------------------------
create or replace function public.update_trip(p_trip_id uuid, p jsonb, p_ack_bookings boolean default false)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t public.trips;
  v_affected integer;
  v_new_departure timestamptz := (p ->> 'departure_at')::timestamptz;
begin
  if not public.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into t from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if t.status = 'cancelled' then raise exception 'TRIP_CANCELLED' using errcode = 'P0001'; end if;

  select count(*) into v_affected from public.bookings
  where status in ('pending', 'confirmed') and (trip_id = p_trip_id or return_trip_id = p_trip_id);

  if v_new_departure is distinct from t.departure_at and v_affected > 0 and not p_ack_bookings then
    raise exception 'HAS_BOOKINGS' using errcode = 'P0001';
  end if;

  update public.trips set
    departure_at = v_new_departure,
    arrival_at = nullif(p ->> 'arrival_at', '')::timestamptz,
    capacity = (p ->> 'capacity')::integer,
    price_override = nullif(p ->> 'price_override', '')::numeric,
    vehicle_id = nullif(p ->> 'vehicle_id', '')::uuid,
    driver_id = nullif(p ->> 'driver_id', '')::uuid,
    notes = coalesce(p ->> 'notes', ''),
    status = case when p ->> 'status' in ('scheduled', 'full') then p ->> 'status' else status end
  where id = p_trip_id;

  if v_new_departure is distinct from t.departure_at then
    update public.bookings set departure_at = v_new_departure
      where trip_id = p_trip_id and status in ('pending', 'confirmed');
    update public.bookings set return_departure_at = v_new_departure
      where return_trip_id = p_trip_id and status in ('pending', 'confirmed');
  end if;

  return jsonb_build_object('affected_bookings', v_affected);
end;
$$;

-- ---------------------------------------------------------------------------
--  RPC: cancel_trip (admin)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_trip(p_trip_id uuid, p_reason text default null, p_cancel_bookings boolean default false)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t public.trips;
  v_affected integer;
begin
  if not public.is_manager() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into t from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001'; end if;

  select count(*) into v_affected from public.bookings
  where status in ('pending', 'confirmed') and (trip_id = p_trip_id or return_trip_id = p_trip_id);

  update public.trips set status = 'cancelled', cancelled_at = now(),
    cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_trip_id;

  if p_cancel_bookings then
    update public.bookings set status = 'cancelled', cancelled_at = now(),
      cancel_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Polazak je otkazan.')
    where status in ('pending', 'confirmed') and (trip_id = p_trip_id or return_trip_id = p_trip_id);
  end if;

  return jsonb_build_object('affected_bookings', v_affected, 'bookings_cancelled', p_cancel_bookings);
end;
$$;

-- Only the server (service role) may create bookings directly.
revoke all on function public.create_booking(jsonb) from public, anon, authenticated;
grant execute on function public.create_booking(jsonb) to service_role;

revoke all on function public.set_booking_status(uuid, text, text) from public, anon;
grant execute on function public.set_booking_status(uuid, text, text) to authenticated, service_role;
revoke all on function public.create_trips(jsonb) from public, anon;
grant execute on function public.create_trips(jsonb) to authenticated, service_role;
revoke all on function public.update_trip(uuid, jsonb, boolean) from public, anon;
grant execute on function public.update_trip(uuid, jsonb, boolean) to authenticated, service_role;
revoke all on function public.cancel_trip(uuid, text, boolean) from public, anon;
grant execute on function public.cancel_trip(uuid, text, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
--  Row Level Security
--  Anonymous visitors get NO direct table access at all. The public website reads
--  the (non-private) data it needs through the server, and bookings are created
--  only through the validated create_booking() flow.
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.destinations enable row level security;
alter table public.routes enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.trips enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;

-- settings
create policy settings_select on public.settings for select to authenticated using (public.is_admin());
create policy settings_update on public.settings for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- admin_users: everyone sees their own row; managers see all.
create policy admin_users_select on public.admin_users for select to authenticated
  using (user_id = auth.uid() or public.is_manager());

-- configuration tables: any admin reads, managers write.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['destinations', 'routes', 'vehicles', 'drivers', 'trips', 'blocked_dates'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())',
                   tbl || '_select', tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_manager())',
                   tbl || '_insert', tbl);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_manager()) with check (public.is_manager())',
                   tbl || '_update', tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_manager())',
                   tbl || '_delete', tbl);
  end loop;
end $$;

-- bookings & notifications: any admin may read and update (status changes go through the RPC).
create policy bookings_select on public.bookings for select to authenticated using (public.is_admin());
create policy bookings_update on public.bookings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy notifications_select on public.notifications for select to authenticated using (public.is_admin());

-- Defence in depth: the anonymous role has no table privileges at all.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant select on public.trip_availability to authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
--  Storage: public bucket for destination images, writable by managers only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destination-images', 'destination-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy destination_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'destination-images' and public.is_manager());
create policy destination_images_update on storage.objects for update to authenticated
  using (bucket_id = 'destination-images' and public.is_manager());
create policy destination_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'destination-images' and public.is_manager());
