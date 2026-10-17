"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Filter, Mail, MessageCircle, Phone, Search, Ticket, X } from "lucide-react";
import {
  getBookingNotifications,
  saveInternalNotes,
  setBookingStatus,
  updateBookingContact,
  type NotificationEntry,
} from "@/app/admin/actions/bookings";
import { WhatsAppIcon } from "@/components/icons";
import { Card, ConfirmDialog, EmptyState, Field, Modal, PageHeader, StatusBadge, useRunner } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/reservations/pricing";
import { formatDateShort, formatDateTimeSr } from "@/lib/reservations/time";
import { STATUS_LABELS, type BookingRow } from "@/lib/reservations/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Filters = { q: string; status: string; route: string; trip: string; from: string; to: string };
type Props = {
  bookings: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: Filters;
  routes: { id: string; label: string }[];
  timezone: string;
  currency: string;
  companyName: string;
};

function queryString(filters: Partial<Filters>, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function BookingsManager({ bookings, total, page, pageSize, filters, routes, timezone, currency, companyName }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Object.values(filters).some(Boolean);
  const tz = timezone;

  return (
    <>
      <PageHeader
        title="Rezervacije"
        description="Pretražite, potvrdite ili otkažite rezervacije i kontaktirajte putnike."
        actions={
          <ButtonLink href={`/api/admin/bookings/export${queryString(filters)}`} variant="outline" size="sm" download>
            <Download className="size-4" aria-hidden="true" />
            Izvezi CSV
          </ButtonLink>
        }
      />

      <Card className="mb-6 p-4 sm:p-5">
        <form method="get" action="/admin/bookings" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <label htmlFor="f-q" className="sr-only">
              Pretraga
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="f-q" name="q" defaultValue={filters.q} placeholder="Ime, telefon ili broj rezervacije" className="pl-10" />
          </div>
          <div>
            <label htmlFor="f-status" className="sr-only">
              Status
            </label>
            <Select id="f-status" name="status" defaultValue={filters.status}>
              <option value="">Svi statusi</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="f-route" className="sr-only">
              Relacija
            </label>
            <Select id="f-route" name="route" defaultValue={filters.route}>
              <option value="">Sve relacije</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="f-from" className="sr-only">
              Polazak od
            </label>
            <Input id="f-from" name="from" type="date" defaultValue={filters.from} title="Polazak od" />
          </div>
          <div>
            <label htmlFor="f-to" className="sr-only">
              Polazak do
            </label>
            <Input id="f-to" name="to" type="date" defaultValue={filters.to} title="Polazak do" />
          </div>
          {filters.trip ? <input type="hidden" name="trip" value={filters.trip} /> : null}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <Button type="submit" size="sm">
              <Filter className="size-4" aria-hidden="true" />
              Primeni filtere
            </Button>
            {hasFilters ? (
              <ButtonLink href="/admin/bookings" variant="ghost" size="sm">
                <X className="size-4" aria-hidden="true" />
                Poništi
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Card>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-5" aria-hidden="true" />}
          title={hasFilters ? "Nema rezervacija za izabrane filtere" : "Još nema rezervacija"}
          description={hasFilters ? "Probajte da promenite ili poništite filtere." : "Kada putnici pošalju rezervaciju sa stranice /booking, pojaviće se ovde."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {total} {total === 1 ? "rezervacija" : "rezervacija"} · strana {page} od {pages}
          </p>

          {/* Desktop table */}
          <div className="surface-raised hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hair text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3.5 font-semibold">Rezervacija</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold">Klijent</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold">Relacija i polazak</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-semibold">Putnika</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-semibold">Cena</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {bookings.map((b) => (
                  <tr key={b.id} className="cursor-pointer transition-colors hover:bg-white/[0.03]" onClick={() => setSelectedId(b.id)}>
                    <td className="px-4 py-3.5 align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(b.id);
                        }}
                        className="font-bold tracking-wide text-brand hover:underline"
                      >
                        {b.reference}
                      </button>
                      <p className="mt-0.5 text-xs text-muted">{formatDateShort(b.created_at, tz)}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <p className="font-semibold">{b.customer_name}</p>
                      <p className="text-xs text-muted">{b.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <p className="font-semibold">
                        {b.origin_name} → {b.destination_name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTimeSr(b.departure_at, tz)}
                        {b.return_departure_at ? " · povratna" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right align-top tabular-nums">{b.passengers}</td>
                    <td className="px-4 py-3.5 text-right align-top font-semibold tabular-nums">{formatMoney(Number(b.total_price), b.currency)}</td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {bookings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className="surface-raised block w-full rounded-2xl p-4 text-left transition-colors hover:border-white/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold tracking-wide text-brand">{b.reference}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-2 font-semibold">{b.customer_name}</p>
                  <p className="text-sm text-muted">{b.customer_phone}</p>
                  <p className="mt-2 text-sm">
                    {b.origin_name} → {b.destination_name}
                  </p>
                  <p className="text-xs text-muted">{formatDateTimeSr(b.departure_at, tz)}</p>
                  <p className="mt-2 flex justify-between text-sm">
                    <span className="text-muted">{b.passengers} putnika</span>
                    <span className="font-bold tabular-nums">{formatMoney(Number(b.total_price), b.currency)}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {pages > 1 ? (
            <nav aria-label="Stranice" className="mt-6 flex items-center justify-between">
              <ButtonLink
                href={`/admin/bookings${queryString(filters, { page: String(page - 1) })}`}
                variant="outline"
                size="sm"
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Prethodna
              </ButtonLink>
              <span className="text-sm text-muted tabular-nums">
                {page} / {pages}
              </span>
              <ButtonLink
                href={`/admin/bookings${queryString(filters, { page: String(page + 1) })}`}
                variant="outline"
                size="sm"
                aria-disabled={page >= pages}
                tabIndex={page >= pages ? -1 : undefined}
              >
                Sledeća
                <ChevronRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </nav>
          ) : null}
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Rezervacija ${selected.reference}` : "Rezervacija"}
        size="lg"
      >
        {selected ? <BookingDetail key={selected.id + selected.updated_at} booking={selected} timezone={tz} currency={currency} companyName={companyName} /> : null}
      </Modal>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

function BookingDetail({ booking: b, timezone: tz, currency, companyName }: { booking: BookingRow; timezone: string; currency: string; companyName: string }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(b.customer_name);
  const [phone, setPhone] = useState(b.customer_phone);
  const [email, setEmail] = useState(b.customer_email ?? "");
  const [internal, setInternal] = useState(b.internal_notes);
  const [confirm, setConfirm] = useState<null | "cancelled" | "completed" | "pending">(null);
  const [log, setLog] = useState<NotificationEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    getBookingNotifications(b.id).then((r) => {
      if (alive) setLog(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [b.id]);

  const digits = b.customer_phone.replace(/\D/g, "");
  const dep = formatDateTimeSr(b.departure_at, tz);
  const greeting =
    b.status === "confirmed"
      ? `Poštovani ${b.customer_name}, vaša rezervacija ${b.reference} (${b.origin_name} → ${b.destination_name}, ${dep}) je potvrđena.`
      : b.status === "cancelled"
        ? `Poštovani ${b.customer_name}, nažalost morali smo da otkažemo rezervaciju ${b.reference} (${b.origin_name} → ${b.destination_name}, ${dep}).`
        : `Poštovani ${b.customer_name}, javljamo se u vezi rezervacije ${b.reference} (${b.origin_name} → ${b.destination_name}, ${dep}).`;
  const waUrl = buildWhatsAppUrl(`${greeting}\n${companyName}`, digits);

  const contactChanged = name !== b.customer_name || phone !== b.customer_phone || email !== (b.customer_email ?? "");

  const changeStatus = (status: "pending" | "confirmed" | "cancelled" | "completed", reason?: string) =>
    run(() => setBookingStatus(b.id, status, reason), { onSuccess: () => setConfirm(null) });

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={b.status} />
        <p className="text-xs text-muted">Kreirano {formatDateTimeSr(b.created_at, tz)}</p>
      </div>

      <section aria-label="Detalji vožnje">
        <dl className="divide-y divide-hair rounded-xl border border-line px-4">
          <Row label="Relacija">
            {b.origin_name} → {b.destination_name}
          </Row>
          <Row label="Polazak">{dep}</Row>
          {b.return_departure_at ? <Row label="Povratak">{formatDateTimeSr(b.return_departure_at, tz)}</Row> : null}
          <Row label="Putnika / prtljag">
            {b.passengers} / {b.luggage}
          </Row>
          <Row label="Način obračuna">{b.pricing_mode === "per_person" ? "Po osobi" : "Privatno vozilo"}</Row>
        </dl>
        {b.notes ? (
          <p className="mt-3 rounded-xl border border-line bg-field/50 p-3 text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Napomena klijenta</span>
            {b.notes}
          </p>
        ) : null}
        {b.cancel_reason ? (
          <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">Razlog otkazivanja: {b.cancel_reason}</p>
        ) : null}
      </section>

      <section aria-label="Cena (nepromenljiva)">
        <h3 className="mb-2 text-sm font-semibold">Dogovorena cena</h3>
        <ul className="space-y-1.5 rounded-xl border border-line p-4 text-sm">
          {b.price_breakdown.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="text-muted">
                {l.label}
                {l.detail ? ` (${l.detail})` : ""}
              </span>
              <span className="tabular-nums">{formatMoney(Number(l.amount), b.currency || currency)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-hair pt-2 text-base font-bold">
            <span>Ukupno</span>
            <span className="tabular-nums">{formatMoney(Number(b.total_price), b.currency || currency)}</span>
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted">Cena je zabeležena u trenutku rezervacije i ne menja se kada se cene relacije promene.</p>
      </section>

      <section aria-label="Podaci o klijentu">
        <h3 className="mb-3 text-sm font-semibold">Podaci o klijentu</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ime i prezime" htmlFor="d-name" className="sm:col-span-2">
            <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Telefon" htmlFor="d-phone" hint="Sa pozivnim brojem, npr. +38161…">
            <Input id="d-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="E-adresa" htmlFor="d-email">
            <Input id="d-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        {contactChanged ? (
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={pending}
            onClick={() => run(() => updateBookingContact(b.id, { name, phone, email }), { success: "Podaci o klijentu su sačuvani." })}
          >
            <Check className="size-4" aria-hidden="true" />
            Sačuvaj podatke
          </Button>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={waUrl} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="sm">
            <WhatsAppIcon className="size-4" />
            WhatsApp klijentu
          </ButtonLink>
          <ButtonLink href={`tel:${b.customer_phone}`} variant="outline" size="sm">
            <Phone className="size-4" aria-hidden="true" />
            Pozovi
          </ButtonLink>
          {b.customer_email ? (
            <ButtonLink href={`mailto:${b.customer_email}`} variant="outline" size="sm">
              <Mail className="size-4" aria-hidden="true" />
              E-pošta
            </ButtonLink>
          ) : null}
        </div>
      </section>

      <section aria-label="Interna beleška">
        <Field label="Interna beleška" htmlFor="d-internal" hint="Vidljiva samo administratorima.">
          <Textarea id="d-internal" rows={3} value={internal} maxLength={2000} onChange={(e) => setInternal(e.target.value)} />
        </Field>
        {internal !== b.internal_notes ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={pending}
            onClick={() => run(() => saveInternalNotes(b.id, internal), { success: "Beleška je sačuvana." })}
          >
            <Check className="size-4" aria-hidden="true" />
            Sačuvaj belešku
          </Button>
        ) : null}
      </section>

      <section aria-label="Obaveštenja">
        <h3 className="mb-2 text-sm font-semibold">Istorija obaveštenja</h3>
        {log === null ? (
          <p className="text-sm text-muted">Učitavanje…</p>
        ) : log.length === 0 ? (
          <p className="text-sm text-muted">Nema zabeleženih obaveštenja.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {log.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-2 rounded-lg border border-line px-3 py-2">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  {n.channel === "whatsapp" ? <MessageCircle className="size-3.5" aria-hidden="true" /> : <Mail className="size-3.5" aria-hidden="true" />}
                  {n.recipient === "admin" ? "Administrator" : "Klijent"} · {n.channel === "whatsapp" ? "WhatsApp" : "e-pošta"}
                </span>
                <span
                  className={
                    n.status === "sent" ? "text-whatsapp" : n.status === "failed" ? "text-danger" : "text-muted"
                  }
                >
                  {n.status === "sent" ? "poslato" : n.status === "failed" ? "nije uspelo" : "preskočeno"}
                </span>
                <span className="text-muted">
                  {n.detail ? `— ${n.detail} ` : ""}({formatDateTimeSr(n.created_at, tz)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2 border-t border-hair pt-5 sm:flex-row sm:flex-wrap sm:justify-end">
        {b.status === "pending" ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirm("cancelled")}>
              Otkaži
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={() => changeStatus("confirmed")}>
              <Check className="size-4" aria-hidden="true" />
              Potvrdi rezervaciju
            </Button>
          </>
        ) : null}
        {b.status === "confirmed" ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirm("cancelled")}>
              Otkaži
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={() => setConfirm("completed")}>
              <Check className="size-4" aria-hidden="true" />
              Označi kao završeno
            </Button>
          </>
        ) : null}
        {b.status === "cancelled" ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirm("pending")}>
            Vrati na čekanje
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm === "cancelled"}
        onClose={() => setConfirm(null)}
        title="Otkazati rezervaciju?"
        description={
          <>
            Rezervacija <strong className="text-fg">{b.reference}</strong> će biti otkazana, a mesta se oslobađaju za nove putnike.
            {b.customer_email ? " Klijent će dobiti obaveštenje e-poštom." : " Klijent nema e-adresu — obavestite ga putem WhatsApp-a."}
          </>
        }
        confirmLabel="Da, otkaži"
        reasonLabel="Razlog (opciono, vidi ga klijent u e-poruci)"
        pending={pending}
        onConfirm={(reason) => changeStatus("cancelled", reason)}
      />
      <ConfirmDialog
        open={confirm === "completed"}
        onClose={() => setConfirm(null)}
        title="Označiti vožnju kao završenu?"
        description="Status će biti „završeno“ i prihod se računa u statistici. Ovu promenu nije moguće poništiti."
        confirmLabel="Da, završeno"
        tone="default"
        pending={pending}
        onConfirm={() => changeStatus("completed")}
      />
      <ConfirmDialog
        open={confirm === "pending"}
        onClose={() => setConfirm(null)}
        title="Vratiti rezervaciju na čekanje?"
        description="Mesta će ponovo biti zauzeta ako ih ima dovoljno na izabranom polasku (u suprotnom promena neće proći)."
        confirmLabel="Vrati na čekanje"
        tone="default"
        pending={pending}
        onConfirm={() => changeStatus("pending")}
      />
    </div>
  );
}
