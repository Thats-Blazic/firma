"use client";

import { useState } from "react";
import { Ban, CalendarClock, CheckCircle2, Loader2, Pencil, Plus, Route as RouteIcon, Ticket, Trash2, X } from "lucide-react";
import { deleteRoute, saveRoute, setRouteActive } from "@/app/admin/actions/routes";
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, Switch, useRunner } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/reservations/pricing";
import type { Fee } from "@/lib/reservations/types";

export type RouteListItem = {
  id: string;
  label: string;
  originId: string;
  destinationId: string;
  pricingMode: "per_person" | "per_vehicle";
  basePrice: number;
  returnPrice: number | null;
  allowReturn: boolean;
  fees: Fee[];
  notes: string;
  isActive: boolean;
  bookings: number;
  upcomingTrips: number;
};

type DestinationChoice = { id: string; name: string; isPickup: boolean; isDestination: boolean };

const MODE_LABEL = { per_person: "po osobi", per_vehicle: "po vozilu (privatna vožnja)" } as const;

export function RoutesManager({ routes, destinations, currency, canManage }: { routes: RouteListItem[]; destinations: DestinationChoice[]; currency: string; canManage: boolean }) {
  const { run, pending } = useRunner();
  const [editing, setEditing] = useState<RouteListItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<RouteListItem | null>(null);

  return (
    <>
      <PageHeader
        title="Relacije i cene"
        description="Svaka relacija je jedan smer (npr. Aerodrom → Hotel) sa sopstvenom cenom. Izmena cene važi samo za nove rezervacije — postojeće zadržavaju cenu iz trenutka rezervacije."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")} disabled={destinations.length < 2}>
              <Plus className="size-4" aria-hidden="true" />
              Nova relacija
            </Button>
          ) : null
        }
      />

      {destinations.length < 2 ? (
        <EmptyState
          icon={<RouteIcon className="size-5" aria-hidden="true" />}
          title="Potrebne su bar dve aktivne destinacije"
          description="Relacija povezuje polazište i odredište. Prvo dodajte destinacije."
          action={
            <ButtonLink href="/admin/destinations" size="sm">
              Idi na destinacije
            </ButtonLink>
          }
        />
      ) : routes.length === 0 ? (
        <EmptyState
          icon={<RouteIcon className="size-5" aria-hidden="true" />}
          title="Još nema relacija"
          description="Dodajte prvu relaciju i cenu. Za povratnu vožnju kreirajte i obrnutu relaciju (ili omogućite povratak i unesite cenu povratka)."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" aria-hidden="true" />
                Nova relacija
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {routes.map((r) => (
            <li key={r.id} className={`surface-raised rounded-2xl p-4 sm:p-5 ${r.isActive ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{r.label}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {MODE_LABEL[r.pricingMode]}
                    {r.allowReturn ? " · povratna dozvoljena" : " · samo u jednom smeru"}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${r.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-muted"}`}>
                  {r.isActive ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />}
                  {r.isActive ? "Aktivna" : "Neaktivna"}
                </span>
              </div>

              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">Cena</dt>
                  <dd className="mt-0.5 text-base font-bold tabular-nums">{formatMoney(r.basePrice, currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">Povratak</dt>
                  <dd className="mt-0.5 tabular-nums">
                    {!r.allowReturn ? "—" : r.returnPrice !== null ? formatMoney(r.returnPrice, currency) : "cena obrnute relacije"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">Dodatne naknade</dt>
                  <dd className="mt-0.5">
                    {r.fees.length === 0
                      ? "—"
                      : r.fees.map((f) => `${f.label} ${formatMoney(f.amount, currency)}${f.per === "person" ? "/os." : ""}`).join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">Aktivnost</dt>
                  <dd className="mt-0.5">
                    {r.upcomingTrips} polazaka · {r.bookings} rezervacija
                  </dd>
                </div>
              </dl>
              {r.notes ? <p className="mt-3 text-sm text-muted">{r.notes}</p> : null}

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hair pt-3">
                <ButtonLink href={`/admin/bookings?route=${r.id}`} variant="outline" size="sm">
                  <Ticket className="size-4" aria-hidden="true" />
                  Rezervacije
                </ButtonLink>
                <ButtonLink href={`/admin/trips?route=${r.id}`} variant="outline" size="sm">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  Polasci
                </ButtonLink>
                {canManage ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Izmeni
                    </Button>
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setRouteActive(r.id, !r.isActive))}>
                      {r.isActive ? "Onemogući" : "Omogući"}
                    </Button>
                    <Button variant="outline" size="sm" className="text-danger" onClick={() => setDeleting(r)} aria-label={`Obriši ${r.label}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nova relacija" : "Izmeni relaciju"} size="lg">
        {editing !== null ? (
          <RouteForm key={editing === "new" ? "new" : editing.id} route={editing === "new" ? null : editing} destinations={destinations} currency={currency} onDone={() => setEditing(null)} />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Obrisati relaciju?"
        description={
          deleting ? (
            deleting.bookings > 0 || deleting.upcomingTrips > 0 ? (
              <>
                <strong className="text-fg">{deleting.label}</strong> ima polaske ili rezervacije, pa neće biti obrisana — biće onemogućena za nove rezervacije. Istorija ostaje sačuvana.
              </>
            ) : (
              <>
                <strong className="text-fg">{deleting.label}</strong> će biti trajno obrisana.
              </>
            )
          ) : null
        }
        confirmLabel={deleting && (deleting.bookings > 0 || deleting.upcomingTrips > 0) ? "Onemogući" : "Obriši"}
        pending={pending}
        onConfirm={() => deleting && run(() => deleteRoute(deleting.id), { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

function RouteForm({ route, destinations, currency, onDone }: { route: RouteListItem | null; destinations: DestinationChoice[]; currency: string; onDone: () => void }) {
  const { run, pending } = useRunner();
  const [originId, setOriginId] = useState(route?.originId ?? "");
  const [destinationId, setDestinationId] = useState(route?.destinationId ?? "");
  const [pricingMode, setPricingMode] = useState<"per_person" | "per_vehicle">(route?.pricingMode ?? "per_person");
  const [basePrice, setBasePrice] = useState(route ? String(route.basePrice) : "");
  const [allowReturn, setAllowReturn] = useState(route?.allowReturn ?? true);
  const [returnPrice, setReturnPrice] = useState(route?.returnPrice != null ? String(route.returnPrice) : "");
  const [fees, setFees] = useState<{ label: string; amount: string; per: "booking" | "person" }[]>(
    (route?.fees ?? []).map((f) => ({ label: f.label, amount: String(f.amount), per: f.per })),
  );
  const [notes, setNotes] = useState(route?.notes ?? "");
  const [isActive, setIsActive] = useState(route?.isActive ?? true);

  const unit = pricingMode === "per_person" ? "po osobi" : "po vozilu";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveRoute({
              id: route?.id,
              originId,
              destinationId,
              pricingMode,
              basePrice: Number(basePrice),
              returnPrice: allowReturn && returnPrice.trim() !== "" ? Number(returnPrice) : null,
              allowReturn,
              fees: fees.map((f) => ({ label: f.label, amount: Number(f.amount), per: f.per })),
              notes,
              isActive,
            }),
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {route ? (
          <p className="rounded-xl border border-line bg-field/50 p-3 text-sm sm:col-span-2">
            <span className="text-muted">Relacija: </span>
            <strong>{route.label}</strong>
            <span className="mt-1 block text-xs text-muted">Polazište i destinacija se ne mogu menjati nakon kreiranja. Napravite novu relaciju ako je potrebno.</span>
          </p>
        ) : (
          <>
            <Field label="Polazište" htmlFor="rt-origin" required>
              <Select id="rt-origin" value={originId} onChange={(e) => setOriginId(e.target.value)} required>
                <option value="" disabled>
                  Izaberite
                </option>
                {destinations
                  .filter((d) => d.isPickup && d.id !== destinationId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Destinacija" htmlFor="rt-dest" required>
              <Select id="rt-dest" value={destinationId} onChange={(e) => setDestinationId(e.target.value)} required>
                <option value="" disabled>
                  Izaberite
                </option>
                {destinations
                  .filter((d) => d.isDestination && d.id !== originId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </>
        )}

        <Field label="Način naplate" htmlFor="rt-mode" required>
          <Select id="rt-mode" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as "per_person" | "per_vehicle")}>
            <option value="per_person">Po osobi (deljeni prevoz)</option>
            <option value="per_vehicle">Po vozilu (fiksna cena)</option>
          </Select>
        </Field>
        <Field label={`Cena ${unit} (${currency})`} htmlFor="rt-price" required>
          <Input id="rt-price" type="number" min={0} step="0.01" inputMode="decimal" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
        </Field>

        <div className="sm:col-span-2">
          <Switch
            id="rt-return"
            checked={allowReturn}
            onChange={setAllowReturn}
            label="Dozvoli povratnu vožnju"
            description="Putnik može da doda povratak. Povratak je polazak na obrnutoj relaciji, koju takođe treba kreirati."
          />
        </div>
        {allowReturn ? (
          <Field label={`Cena povratka ${unit} (${currency}, opciono)`} htmlFor="rt-return-price" hint="Prazno = koristi se cena obrnute relacije." className="sm:col-span-2">
            <Input id="rt-return-price" type="number" min={0} step="0.01" inputMode="decimal" value={returnPrice} onChange={(e) => setReturnPrice(e.target.value)} />
          </Field>
        ) : null}

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Dodatne naknade</legend>
          {fees.length === 0 ? <p className="mb-2 text-xs text-muted">Npr. noćna vožnja, dodatni prtljag, čekanje.</p> : null}
          <ul className="space-y-2">
            {fees.map((f, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
                <Input aria-label={`Naziv naknade ${i + 1}`} placeholder="Naziv" value={f.label} maxLength={60} onChange={(e) => setFees((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} required />
                <button
                  type="button"
                  aria-label="Ukloni naknadu"
                  onClick={() => setFees((all) => all.filter((_, j) => j !== i))}
                  className="grid size-11 place-items-center rounded-lg text-muted hover:bg-white/[0.08] hover:text-fg sm:order-last"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
                <Input aria-label={`Iznos naknade ${i + 1}`} type="number" min={0} step="0.01" inputMode="decimal" placeholder="Iznos" value={f.amount} onChange={(e) => setFees((all) => all.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} required />
                <Select aria-label={`Obračun naknade ${i + 1}`} value={f.per} onChange={(e) => setFees((all) => all.map((x, j) => (j === i ? { ...x, per: e.target.value as "booking" | "person" } : x)))}>
                  <option value="booking">po rezervaciji</option>
                  <option value="person">po osobi</option>
                </Select>
              </li>
            ))}
          </ul>
          {fees.length < 10 ? (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setFees((all) => [...all, { label: "", amount: "", per: "booking" }])}>
              <Plus className="size-4" aria-hidden="true" />
              Dodaj naknadu
            </Button>
          ) : null}
        </fieldset>

        <Field label="Napomena (interna)" htmlFor="rt-notes" className="sm:col-span-2">
          <Textarea id="rt-notes" rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Switch id="rt-active" checked={isActive} onChange={setIsActive} label="Aktivna" description="Neaktivna relacija se ne prikazuje putnicima." />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-hair pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Odustani
        </Button>
        <Button type="submit" size="sm" disabled={pending || (!route && (!originId || !destinationId))}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Sačuvaj
        </Button>
      </div>
    </form>
  );
}
