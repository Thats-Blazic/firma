-- 0002: fix create_booking on Supabase.
-- pgcrypto lives in the "extensions" schema on Supabase, so the unqualified gen_random_bytes()
-- is not visible with search_path = public. The booking reference now uses gen_random_uuid()
-- (built in), which needs no extension. Safe to run once on a database that already ran 0001.

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
