import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const db = new PGlite({ extensions: { pgcrypto } });
let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  â€” " + extra : ""}`);
  if (!cond) failures++;
};
const expectError = async (name, fn, code) => {
  try {
    await fn();
    ok(name, false, "no error thrown");
  } catch (e) {
    ok(name, String(e.message).includes(code), `got: ${e.message}`);
  }
};

// --- Supabase stand-ins -----------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

await db.exec(readFileSync(here("../migrations/0001_init.sql"), "utf8"));
await db.exec(readFileSync(here("../seed.sql"), "utf8"));
ok("migration + seed run without errors", true);

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;

// --- fixtures (as superuser, i.e. service role) -----------------------------
const admin = await one(`insert into auth.users default values returning id`);
const staff = await one(`insert into auth.users default values returning id`);
await db.query(`insert into admin_users (user_id,email,role) values ($1,'a@x.com','admin'), ($2,'s@x.com','staff')`, [admin.id, staff.id]);

const A = await one(`select id from destinations where slug='beograd'`);
const B = await one(`select id from destinations where slug='budva'`);
const rAB = await one(`insert into routes (origin_id,destination_id,pricing_mode,base_price,return_price) values ($1,$2,'per_person',30,25) returning *`, [A.id, B.id]);
const rBA = await one(`insert into routes (origin_id,destination_id,pricing_mode,base_price) values ($1,$2,'per_person',30) returning *`, [B.id, A.id]);

const future = (days, hour = 10) => {
  const d = new Date(Date.now() + days * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

const mk = async (route, days, cap = 4, hour = 10) =>
  one(`insert into trips (route_id,departure_at,capacity) values ($1,$2,$3) returning *`, [route, future(days, hour), cap]);

const t1 = await mk(rAB.id, 5, 4);
const tBack = await mk(rBA.id, 9, 4);

const payload = (trip, over = {}) => ({
  trip_id: trip.id,
  return_trip_id: null,
  passengers: 2,
  luggage: 1,
  customer_name: "Marko Test",
  customer_phone: "+38161000" + Math.floor(Math.random() * 9000 + 1000),
  customer_email: null,
  notes: "",
  idempotency_key: crypto.randomUUID(),
  unit_price: 30,
  return_unit_price: null,
  total_price: 60,
  price_breakdown: [],
  versions: { route: undefined, trip: trip.updated_at },
  ...over,
});
const book = async (trip, route, over = {}) => {
  const p = payload(trip, over);
  p.versions = { route: route.updated_at, trip: trip.updated_at, ...(over.versions ?? {}) };
  const r = await one(`select public.create_booking($1::jsonb) as r`, [JSON.stringify(p)]);
  return r.r;
};

// --- booking creation ---------------------------------------------------------
const b1 = await book(t1, rAB);
ok("booking created with reference AT-XXXXXX", /^AT-[A-Z2-9]{6}$/.test(b1.reference), b1.reference);
ok("manual mode â†’ pending", b1.status === "pending");

const dupKey = crypto.randomUUID();
const d1 = await book(t1, rAB, { idempotency_key: dupKey, passengers: 1, customer_phone: "+381611111111" });
const d2 = await book(t1, rAB, { idempotency_key: dupKey, passengers: 1, customer_phone: "+381611111111" });
ok("same idempotency key returns the same booking", d1.reference === d2.reference && d2.duplicate === true);
const d3 = await book(t1, rAB, { passengers: 1, customer_phone: "+381611111111" });
ok("same phone/trip/pax within 10 min is treated as duplicate", d3.duplicate === true);

// capacity 4, 2 + 1 booked â†’ 1 left
await expectError("overbooking is rejected (needs 2, 1 left)", () => book(t1, rAB, { passengers: 2 }), "NOT_ENOUGH_SEATS");
const last = await book(t1, rAB, { passengers: 1, customer_phone: "+381622222222" });
ok("exactly filling capacity works", !!last.reference);
await expectError("fully booked trip rejects new bookings", () => book(t1, rAB, { passengers: 1, customer_phone: "+381633333333" }), "NOT_ENOUGH_SEATS");
const av = await one(`select booked, remaining from trip_availability where id=$1`, [t1.id]);
ok("availability view: booked=4 remaining=0", av.booked == 4 && av.remaining == 0, JSON.stringify(av));

// cancel frees seats; reconfirm needs seats
const lastRow = await one(`select id from bookings where reference=$1`, [last.reference]);
await db.query(`set test.uid = '${admin.id}'`);
await db.query(`set role authenticated`);
const cancelled = await one(`select * from set_booking_status($1,'cancelled','test')`, [lastRow.id]);
ok("cancelling a booking works", cancelled.status === "cancelled" && cancelled.cancelled_at);
await db.query(`reset role`);
const av2 = await one(`select remaining from trip_availability where id=$1`, [t1.id]);
ok("cancel frees the seat (remaining=1)", av2.remaining == 1);
const refill = await book(t1, rAB, { passengers: 1, customer_phone: "+381644444444" });
ok("freed seat can be re-booked", !!refill.reference);
await db.query(`set role authenticated`);
await expectError("re-confirming a cancelled booking without free seats fails", () => one(`select * from set_booking_status($1,'confirmed')`, [lastRow.id]), "NOT_ENOUGH_SEATS");
await expectError("invalid transition (pendingâ†’completed) rejected", () => one(`select * from set_booking_status((select id from bookings where reference=$1),'completed')`, [b1.reference]), "INVALID_TRANSITION");
const conf = await one(`select * from set_booking_status((select id from bookings where reference=$1),'confirmed')`, [b1.reference]);
ok("pending â†’ confirmed", conf.status === "confirmed" && conf.confirmed_at);
const done = await one(`select * from set_booking_status((select id from bookings where reference=$1),'completed')`, [b1.reference]);
ok("confirmed â†’ completed", done.status === "completed");
await db.query(`reset role`);

// --- return trip ----------------------------------------------------------------
const t2 = await mk(rAB.id, 6, 4, 12);
const rt = await book(t2, rAB, { return_trip_id: tBack.id, versions: { return_trip: tBack.updated_at, return_route: rBA.updated_at }, customer_phone: "+381655555555", total_price: 105 });
ok("round trip booking holds seats on both trips", !!rt.reference);
const avBack = await one(`select booked from trip_availability where id=$1`, [tBack.id]);
ok("return trip seats counted (2)", avBack.booked == 2);
await expectError(
  "return trip on the SAME direction is rejected",
  async () => book(t2, rAB, { return_trip_id: (await mk(rAB.id, 8, 4, 8)).id, versions: { return_trip: "x", return_route: "x" }, customer_phone: "+381666666666" }),
  "INVALID_RETURN_TRIP",
);
const tEarlyBack = await mk(rBA.id, 5, 4, 9);
await expectError("return before departure rejected", () => book(t2, rAB, { return_trip_id: tEarlyBack.id, versions: { return_trip: tEarlyBack.updated_at, return_route: rBA.updated_at }, customer_phone: "+381677777777" }), "RETURN_BEFORE_DEPARTURE");

// --- price guard ------------------------------------------------------------------
await db.query(`update routes set base_price = 35 where id=$1`, [rAB.id]);
await expectError("stale price version â†’ PRICE_CHANGED", async () => book(await mk(rAB.id, 7, 4, 7), rAB, { customer_phone: "+381688888888" }), "PRICE_CHANGED");

// --- windows, blocked dates, cancelled / full trips -----------------------------------
const rAB2 = await one(`select * from routes where id=$1`, [rAB.id]);
const tSoon = await one(`insert into trips (route_id,departure_at,capacity) values ($1, now() + interval '2 hours', 4) returning *`, [rAB.id]);
await expectError("departure inside the minimum advance window rejected", () => book(tSoon, rAB2), "TOO_SOON");
const tFar = await one(`insert into trips (route_id,departure_at,capacity) values ($1, now() + interval '400 days', 4) returning *`, [rAB.id]);
await expectError("departure beyond the booking window rejected", () => book(tFar, rAB2), "TOO_FAR");

const tBlock = await mk(rAB.id, 20, 4, 11);
await db.query(`insert into blocked_dates (blocked_on, reason) values (($1::timestamptz at time zone 'Europe/Belgrade')::date, 'praznik')`, [tBlock.departure_at]);
const tBlockFresh = await one(`select * from trips where id=$1`, [tBlock.id]);
await expectError("blocked date rejected", () => book(tBlockFresh, rAB2), "DATE_BLOCKED");

const tFull = await mk(rAB.id, 21, 4, 11);
await db.query(`update trips set status='full' where id=$1`, [tFull.id]);
await expectError("trip marked full rejected", async () => book(await one(`select * from trips where id=$1`, [tFull.id]), rAB2), "TRIP_FULL");

const tCx = await mk(rAB.id, 22, 4, 11);
await db.query(`update trips set status='cancelled' where id=$1`, [tCx.id]);
await expectError("cancelled trip rejected", async () => book(await one(`select * from trips where id=$1`, [tCx.id]), rAB2), "TRIP_CANCELLED");

await db.query(`update routes set is_active=false where id=$1`, [rBA.id]);
const tInactive = await mk(rBA.id, 23, 4);
await expectError("inactive route rejected", async () => book(tInactive, await one(`select * from routes where id=$1`, [rBA.id])), "ROUTE_INACTIVE");
await db.query(`update routes set is_active=true where id=$1`, [rBA.id]);

// --- auto confirmation ------------------------------------------------------------------
await db.query(`update settings set confirmation_mode='auto'`);
const tAuto = await mk(rAB.id, 25, 4, 9);
const auto = await book(tAuto, await one(`select * from routes where id=$1`, [rAB.id]), { customer_phone: "+381699999999" });
ok("auto mode â†’ confirmed immediately", auto.status === "confirmed");
await db.query(`update settings set confirmation_mode='manual'`);

// --- immutability & capacity guards ---------------------------------------------------------
await expectError("booking price cannot be edited afterwards", () => db.query(`update bookings set total_price = 1 where reference=$1`, [b1.reference]), "BOOKING_IMMUTABLE");
const okEdit = await db.query(`update bookings set customer_phone='+381600000000', internal_notes='x' where reference=$1 returning 1`, [b1.reference]);
ok("contact info and internal notes remain editable", okEdit.rows.length === 1);
await expectError("capacity cannot drop below booked seats", () => db.query(`update trips set capacity=1 where id=$1`, [t1.id]), "CAPACITY_BELOW_BOOKED");

// --- admin RPCs ---------------------------------------------------------------------------
await db.query(`set test.uid = '${admin.id}'`);
await db.query(`set role authenticated`);
const batch = [10, 10, 11].map((h) => ({ route_id: rAB.id, departure_at: future(40, h), capacity: 4, notes: "" }));
const c1 = await one(`select create_trips($1::jsonb) as r`, [JSON.stringify(batch)]);
ok("recurring creation skips duplicates inside the same batch", c1.r.created === 2 && c1.r.skipped === 1, JSON.stringify(c1.r));
const c2 = await one(`select create_trips($1::jsonb) as r`, [JSON.stringify(batch)]);
ok("re-running the same recurrence creates nothing", c2.r.created === 0 && c2.r.skipped === 3, JSON.stringify(c2.r));

const upd = await one(`select update_trip($1, $2::jsonb, true) as r`, [t2.id, JSON.stringify({ departure_at: future(6, 14), capacity: 4, status: "scheduled", notes: "" })]);
ok("update_trip reports affected bookings", upd.r.affected_bookings >= 1, JSON.stringify(upd.r));
await db.query(`reset role`);
const snap = await one(`select departure_at from bookings where reference=$1`, [rt.reference]);
ok("booking snapshot follows the new departure time", new Date(snap.departure_at).toISOString() === future(6, 14));
await db.query(`set role authenticated`);
await expectError("moving a trip with bookings without acknowledgement is refused", () => one(`select update_trip($1, $2::jsonb, false)`, [t2.id, JSON.stringify({ departure_at: future(6, 16), capacity: 4, status: "scheduled", notes: "" })]), "HAS_BOOKINGS");

const cx = await one(`select cancel_trip($1, 'kvar', true) as r`, [t2.id]);
ok("cancel_trip cancels bookings and reports them", cx.r.affected_bookings >= 1 && cx.r.bookings_cancelled === true);
await db.query(`reset role`);
const cxState = await one(`select status from bookings where reference=$1`, [rt.reference]);
ok("bookings on a cancelled trip are cancelled", cxState.status === "cancelled");
const avBack2 = await one(`select booked from trip_availability where id=$1`, [tBack.id]);
ok("return-leg seats released as well", avBack2.booked == 0);

// --- staff cannot touch configuration; RLS blocks anon -----------------------------------
await db.query(`set test.uid = '${staff.id}'`);
await db.query(`set role authenticated`);
await expectError("staff cannot create trips", () => one(`select create_trips($1::jsonb)`, [JSON.stringify(batch)]), "FORBIDDEN");
const staffBookings = await rows(`select 1 from bookings`);
ok("staff can read bookings", staffBookings.length > 0);
await db.query(`reset role`);

await db.query(`set test.uid = ''`);
await db.query(`set role anon`);
let anonBlocked = false;
try { await db.query(`select * from bookings`); } catch { anonBlocked = true; }
ok("anonymous role cannot read bookings", anonBlocked);
anonBlocked = false;
try { await db.query(`select create_booking('{}'::jsonb)`); } catch { anonBlocked = true; }
ok("anonymous role cannot call create_booking", anonBlocked);
await db.query(`reset role`);

await db.query(`set role authenticated`);
await db.query(`set test.uid = '${crypto.randomUUID()}'`);
const stranger = await rows(`select 1 from bookings`);
ok("authenticated non-admin sees no bookings (RLS)", stranger.length === 0);
const strangerSettings = await rows(`select 1 from settings`);
ok("authenticated non-admin cannot read settings", strangerSettings.length === 0);
await db.query(`reset role`);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
