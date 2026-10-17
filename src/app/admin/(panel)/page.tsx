import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, Euro, Ticket, TrendingUp } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { loadSettings, requireAdminPage } from "@/lib/admin/auth";
import { loadRouteOptions, single } from "@/lib/admin/data";
import { formatMoney } from "@/lib/reservations/pricing";
import { formatDateTimeSr } from "@/lib/reservations/time";
import type { BookingRow, TripAvailabilityRow } from "@/lib/reservations/types";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdminPage();
  const { supabase } = ctx;
  const sp = await searchParams;
  const settings = await loadSettings(supabase);
  const tz = settings.timezone;
  const nowIso = new Date().toISOString();

  const [bookingsRes, upcomingRes, pendingRes, routes] = await Promise.all([
    supabase
      .from("bookings")
      .select("status,total_price,destination_name,passengers")
      .limit(50000),
    supabase
      .from("trip_availability")
      .select("*")
      .gte("departure_at", nowIso)
      .neq("status", "cancelled")
      .order("departure_at")
      .limit(60),
    supabase
      .from("bookings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(6),
    loadRouteOptions(supabase),
  ]);
  if (bookingsRes.error) throw bookingsRes.error;
  if (upcomingRes.error) throw upcomingRes.error;
  if (pendingRes.error) throw pendingRes.error;

  const rows = (bookingsRes.data ?? []) as Pick<BookingRow, "status" | "total_price" | "destination_name" | "passengers">[];
  const count = (s: BookingRow["status"]) => rows.filter((r) => r.status === s).length;
  const revenue = rows
    .filter((r) => r.status === "confirmed" || r.status === "completed")
    .reduce((sum, r) => sum + Number(r.total_price), 0);

  const popularMap = new Map<string, number>();
  for (const r of rows) if (r.status !== "cancelled") popularMap.set(r.destination_name, (popularMap.get(r.destination_name) ?? 0) + 1);
  const popular = [...popularMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const popularMax = popular[0]?.[1] ?? 1;

  const upcomingTrips = ((upcomingRes.data ?? []) as TripAvailabilityRow[]).filter((t) => t.booked > 0);
  const routeLabel = new Map(routes.map((r) => [r.id, r.label]));
  const pending = (pendingRes.data ?? []) as BookingRow[];

  const whatsappApi = Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const emailApi = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

  const stats = [
    { label: "Ukupno rezervacija", value: String(rows.length), Icon: Ticket },
    { label: "Na čekanju", value: String(count("pending")), Icon: Clock3, accent: count("pending") > 0 },
    { label: "Potvrđeno", value: String(count("confirmed")), Icon: CheckCircle2 },
    { label: "Predstojeći polasci", value: String(upcomingTrips.length), Icon: CalendarClock, hint: "sa rezervacijama" },
    { label: "Završene vožnje", value: String(count("completed")), Icon: TrendingUp },
    { label: "Prihod", value: formatMoney(revenue, settings.currency), Icon: Euro, hint: "potvrđeno + završeno" },
  ];

  return (
    <>
      <PageHeader title="Pregled" description={`Stvarni podaci iz baze · vremenska zona ${tz}`} />

      {single(sp.denied) ? (
        <p role="alert" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          Nemate dozvolu za tu stranicu. Podešavanja, cene i polaske menjaju samo administratori.
        </p>
      ) : null}

      <section aria-label="Statistika" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {stats.map(({ label, value, Icon, hint, accent }) => (
          <Card key={label} className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
              <Icon className={`size-4 ${accent ? "text-brand" : "text-muted"}`} aria-hidden="true" />
            </div>
            <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${accent ? "text-brand" : ""}`}>{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Rezervacije koje čekaju potvrdu</h2>
            <Link href="/admin/bookings?status=pending" className="text-sm font-semibold text-brand hover:underline">
              Sve
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nema rezervacija na čekanju.</p>
          ) : (
            <ul className="divide-y divide-hair">
              {pending.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings?q=${b.reference}`} className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-brand">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {b.reference} · {b.customer_name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {b.origin_name} → {b.destination_name} · {formatDateTimeSr(b.departure_at, tz)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Najtraženije destinacije</h2>
          {popular.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Još nema rezervacija.</p>
          ) : (
            <ol className="space-y-3.5">
              {popular.map(([name, n]) => (
                <li key={name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-semibold">{name}</span>
                    <span className="tabular-nums text-muted">{n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="presentation">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(6, (n / popularMax) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Predstojeći polasci sa rezervacijama</h2>
          {ctx.isManager ? (
            <Link href="/admin/trips" className="text-sm font-semibold text-brand hover:underline">
              Svi polasci
            </Link>
          ) : null}
        </div>
        {upcomingTrips.length === 0 ? (
          <EmptyState title="Nema predstojećih polazaka sa rezervacijama" description="Kada putnici rezervišu, polasci će se pojaviti ovde." />
        ) : (
          <ul className="divide-y divide-hair">
            {upcomingTrips.slice(0, 8).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-semibold">{routeLabel.get(t.route_id) ?? "Relacija"}</span>
                  <span className="block text-xs text-muted">{formatDateTimeSr(t.departure_at, tz)}</span>
                </span>
                <span className="tabular-nums text-muted">
                  {t.booked}/{t.capacity} mesta
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-1 font-semibold">Status obaveštenja</h2>
        <p className="mb-4 text-sm text-muted">Pokazuje stvarno stanje podešavanja — poruke se ne šalju dok nisu podešeni pristupni podaci.</p>
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          <IntegrationRow ok={whatsappApi && Boolean(settings.admin_phone)} title="WhatsApp (automatski)" detail={whatsappApi ? (settings.admin_phone ? "Cloud API je podešen." : "Unesite broj za obaveštenja u Podešavanjima.") : "Nije podešeno (WHATSAPP_CLOUD_TOKEN). Koristi se ručni WhatsApp link."} />
          <IntegrationRow ok={emailApi && Boolean(settings.admin_email)} title="E-pošta" detail={emailApi ? (settings.admin_email ? "Provajder je podešen." : "Unesite e-adresu administratora u Podešavanjima.") : "Nije podešeno (RESEND_API_KEY, EMAIL_FROM)."} />
          <IntegrationRow ok={settings.confirmation_mode === "auto"} neutral title="Potvrđivanje" detail={settings.confirmation_mode === "auto" ? "Nove rezervacije se potvrđuju automatski." : "Nove rezervacije čekaju vašu potvrdu."} />
        </ul>
      </Card>
    </>
  );
}

function IntegrationRow({ ok, neutral, title, detail }: { ok: boolean; neutral?: boolean; title: string; detail: string }) {
  return (
    <li className="rounded-xl border border-line bg-card/60 p-4">
      <p className="flex items-center gap-2 font-semibold">
        {neutral ? (
          <CheckCircle2 className="size-4 text-muted" aria-hidden="true" />
        ) : ok ? (
          <CheckCircle2 className="size-4 text-whatsapp" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />
        )}
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>
    </li>
  );
}
