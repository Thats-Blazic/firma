"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteDriver, deleteVehicle, saveDriver, saveSettings, saveVehicle } from "@/app/admin/actions/settings";
import { Card, ConfirmDialog, Field, Modal, PageHeader, Switch, useRunner } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DriverRow, Settings, VehicleRow } from "@/lib/reservations/types";

type Props = {
  settings: Settings;
  fleet: { vehicles: VehicleRow[]; drivers: DriverRow[] };
  notifications: { whatsapp: boolean; email: boolean };
  canManage: boolean;
};

export function SettingsManager({ settings, fleet, notifications, canManage }: Props) {
  return (
    <>
      <PageHeader title="Podešavanja" description="Podaci o firmi, pravila rezervacije, obaveštenja i vozni park." />
      {!canManage ? (
        <p role="status" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Vaša uloga (osoblje) može samo da pregleda podešavanja. Izmene mogu da rade vlasnik i administrator.
        </p>
      ) : null}
      <div className="space-y-8">
        <SettingsForm key={settings.updated_at} settings={settings} notifications={notifications} canManage={canManage} />
        <FleetPanels fleet={fleet} canManage={canManage} />
      </div>
    </>
  );
}

function SettingsForm({ settings, notifications, canManage }: { settings: Settings; notifications: Props["notifications"]; canManage: boolean }) {
  const { run, pending } = useRunner();
  const [v, setV] = useState({
    companyName: settings.company_name,
    companyPhone: settings.company_phone,
    companyEmail: settings.company_email,
    companyAddress: settings.company_address,
    adminPhone: settings.admin_phone,
    adminEmail: settings.admin_email,
    confirmationMode: settings.confirmation_mode,
    minAdvanceHours: String(settings.min_advance_hours),
    maxBookingWindowDays: String(settings.max_booking_window_days),
    defaultCapacity: String(settings.default_capacity),
    cancellationPolicy: settings.cancellation_policy,
    notifyAdminWhatsapp: settings.notify_admin_whatsapp,
    notifyAdminEmail: settings.notify_admin_email,
    notifyCustomerEmail: settings.notify_customer_email,
    timezone: settings.timezone,
  });
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));
  const text = (k: keyof typeof v) => ({
    value: v[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    disabled: !canManage,
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          saveSettings({
            ...v,
            minAdvanceHours: Number(v.minAdvanceHours),
            maxBookingWindowDays: Number(v.maxBookingWindowDays),
            defaultCapacity: Number(v.defaultCapacity),
          }),
        );
      }}
    >
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Firma</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Naziv firme" htmlFor="s-name" required>
            <Input id="s-name" maxLength={80} required {...text("companyName")} />
          </Field>
          <Field label="Telefon firme" htmlFor="s-phone">
            <Input id="s-phone" type="tel" maxLength={30} {...text("companyPhone")} />
          </Field>
          <Field label="E-pošta firme" htmlFor="s-email">
            <Input id="s-email" type="email" maxLength={120} {...text("companyEmail")} />
          </Field>
          <Field label="Adresa" htmlFor="s-address">
            <Input id="s-address" maxLength={200} {...text("companyAddress")} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Pravila rezervacije</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Potvrda rezervacije"
            htmlFor="s-mode"
            hint={v.confirmationMode === "auto" ? "Nove rezervacije su odmah potvrđene." : "Nove rezervacije čekaju vašu potvrdu (status „Na čekanju“)."}
          >
            <Select id="s-mode" value={v.confirmationMode} onChange={(e) => set("confirmationMode", e.target.value as "auto" | "manual")} disabled={!canManage}>
              <option value="manual">Ručna potvrda</option>
              <option value="auto">Automatska potvrda</option>
            </Select>
          </Field>
          <Field label="Standardni kapacitet polaska" htmlFor="s-cap" hint="Početna vrednost pri kreiranju novog polaska.">
            <Input id="s-cap" type="number" min={1} max={60} inputMode="numeric" required {...text("defaultCapacity")} />
          </Field>
          <Field label="Minimalno vreme unapred (sati)" htmlFor="s-adv" hint="Rezervacije bliže polasku od ovoga se ne primaju online.">
            <Input id="s-adv" type="number" min={0} max={2160} inputMode="numeric" required {...text("minAdvanceHours")} />
          </Field>
          <Field label="Koliko unapred se može rezervisati (dana)" htmlFor="s-window">
            <Input id="s-window" type="number" min={1} max={730} inputMode="numeric" required {...text("maxBookingWindowDays")} />
          </Field>
          <Field label="Vremenska zona" htmlFor="s-tz" hint="Svi termini se prikazuju i unose u ovoj zoni.">
            <Input id="s-tz" required {...text("timezone")} />
          </Field>
          <Field label="Valuta" htmlFor="s-cur" hint="Trenutno je podržan samo evro.">
            <Input id="s-cur" value={settings.currency} disabled readOnly />
          </Field>
          <Field label="Pravila otkazivanja" htmlFor="s-policy" className="sm:col-span-2" hint="Prikazuje se putniku pre slanja rezervacije i na potvrdi.">
            <Textarea id="s-policy" rows={3} maxLength={2000} {...text("cancellationPolicy")} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-bold">Obaveštenja</h2>
        <p className="mb-4 text-sm text-muted">Slanje nikad ne blokira rezervaciju. Svaki pokušaj je zabeležen u detaljima rezervacije.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Broj za WhatsApp obaveštenja" htmlFor="s-admin-phone" hint="Međunarodni format bez + (npr. 381612378859).">
            <Input id="s-admin-phone" inputMode="tel" maxLength={20} {...text("adminPhone")} />
          </Field>
          <Field label="E-pošta za obaveštenja" htmlFor="s-admin-email">
            <Input id="s-admin-email" type="email" maxLength={120} {...text("adminEmail")} />
          </Field>
        </div>
        <div className="mt-6 space-y-5">
          <Switch id="n-wa" checked={v.notifyAdminWhatsapp} onChange={(x) => set("notifyAdminWhatsapp", x)} disabled={!canManage} label="Obaveštenje administratoru preko WhatsApp-a" description="Nova rezervacija šalje poruku na gore navedeni broj." />
          <Switch id="n-ae" checked={v.notifyAdminEmail} onChange={(x) => set("notifyAdminEmail", x)} disabled={!canManage} label="Obaveštenje administratoru e-poštom" />
          <Switch id="n-ce" checked={v.notifyCustomerEmail} onChange={(x) => set("notifyCustomerEmail", x)} disabled={!canManage} label="Potvrda putniku e-poštom" description="Šalje se samo ako je putnik uneo e-adresu." />
        </div>
        <ul className="mt-6 space-y-2 text-sm">
          <ServiceStatus ok={notifications.whatsapp} label="WhatsApp Cloud API" help="Postavite WHATSAPP_CLOUD_TOKEN i WHATSAPP_PHONE_NUMBER_ID u okruženju. Dok nije podešeno, administrator dobija samo link za ručno slanje." />
          <ServiceStatus ok={notifications.email} label="Slanje e-pošte (Resend)" help="Postavite RESEND_API_KEY i EMAIL_FROM u okruženju. Dok nije podešeno, e-pošta se ne šalje." />
        </ul>
      </Card>

      {canManage ? (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button type="submit" disabled={pending} className="shadow-lg shadow-black/40">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Sačuvaj podešavanja
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function ServiceStatus({ ok, label, help }: { ok: boolean; label: string; help: string }) {
  return (
    <li className={`flex gap-3 rounded-xl border p-3 ${ok ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-amber-400/25 bg-amber-400/[0.07]"}`}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />}
      <span>
        <span className="block font-semibold">
          {label}: {ok ? "podešeno" : "nije podešeno"}
        </span>
        {ok ? null : <span className="text-xs text-muted">{help}</span>}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
//  Vehicles and drivers
// ---------------------------------------------------------------------------
function FleetPanels({ fleet, canManage }: { fleet: Props["fleet"]; canManage: boolean }) {
  const { run, pending } = useRunner();
  const [vehicle, setVehicle] = useState<VehicleRow | "new" | null>(null);
  const [driver, setDriver] = useState<DriverRow | "new" | null>(null);
  const [delVehicle, setDelVehicle] = useState<VehicleRow | null>(null);
  const [delDriver, setDelDriver] = useState<DriverRow | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="veh-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="veh-title" className="text-lg font-bold">
            Vozila
          </h2>
          {canManage ? (
            <Button variant="outline" size="sm" onClick={() => setVehicle("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Dodaj
            </Button>
          ) : null}
        </div>
        {fleet.vehicles.length === 0 ? (
          <p className="text-sm text-muted">Nema vozila. Opciono — koristi se za dodelu polascima.</p>
        ) : (
          <ul className="divide-y divide-hair overflow-hidden rounded-2xl border border-line">
            {fleet.vehicles.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className={x.is_active ? "" : "opacity-50"}>
                  <span className="block font-semibold">{x.name}</span>
                  <span className="text-xs text-muted">
                    {x.capacity} mesta{x.plate ? ` · ${x.plate}` : ""}
                    {x.is_active ? "" : " · neaktivno"}
                  </span>
                </span>
                {canManage ? (
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setVehicle(x)} aria-label={`Izmeni ${x.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDelVehicle(x)} aria-label={`Obriši ${x.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="drv-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="drv-title" className="text-lg font-bold">
            Vozači
          </h2>
          {canManage ? (
            <Button variant="outline" size="sm" onClick={() => setDriver("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Dodaj
            </Button>
          ) : null}
        </div>
        {fleet.drivers.length === 0 ? (
          <p className="text-sm text-muted">Nema vozača. Opciono — koristi se za dodelu polascima.</p>
        ) : (
          <ul className="divide-y divide-hair overflow-hidden rounded-2xl border border-line">
            {fleet.drivers.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className={x.is_active ? "" : "opacity-50"}>
                  <span className="block font-semibold">{x.name}</span>
                  <span className="text-xs text-muted">
                    {x.phone || "bez telefona"}
                    {x.is_active ? "" : " · neaktivan"}
                  </span>
                </span>
                {canManage ? (
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDriver(x)} aria-label={`Izmeni ${x.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDelDriver(x)} aria-label={`Obriši ${x.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={vehicle !== null} onClose={() => setVehicle(null)} title={vehicle === "new" ? "Novo vozilo" : "Izmeni vozilo"} size="sm">
        {vehicle !== null ? <VehicleForm key={vehicle === "new" ? "new" : vehicle.id} vehicle={vehicle === "new" ? null : vehicle} onDone={() => setVehicle(null)} /> : null}
      </Modal>
      <Modal open={driver !== null} onClose={() => setDriver(null)} title={driver === "new" ? "Novi vozač" : "Izmeni vozača"} size="sm">
        {driver !== null ? <DriverForm key={driver === "new" ? "new" : driver.id} driver={driver === "new" ? null : driver} onDone={() => setDriver(null)} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(delVehicle)}
        onClose={() => setDelVehicle(null)}
        title="Obrisati vozilo?"
        description={delVehicle ? `${delVehicle.name} će biti uklonjeno. Polasci koji su ga koristili ostaju bez dodeljenog vozila.` : null}
        confirmLabel="Obriši"
        pending={pending}
        onConfirm={() => delVehicle && run(() => deleteVehicle(delVehicle.id), { onSuccess: () => setDelVehicle(null) })}
      />
      <ConfirmDialog
        open={Boolean(delDriver)}
        onClose={() => setDelDriver(null)}
        title="Obrisati vozača?"
        description={delDriver ? `${delDriver.name} će biti uklonjen iz liste. Polasci ostaju bez dodeljenog vozača.` : null}
        confirmLabel="Obriši"
        pending={pending}
        onConfirm={() => delDriver && run(() => deleteDriver(delDriver.id), { onSuccess: () => setDelDriver(null) })}
      />
    </div>
  );
}

function VehicleForm({ vehicle, onDone }: { vehicle: VehicleRow | null; onDone: () => void }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(vehicle?.name ?? "");
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [capacity, setCapacity] = useState(String(vehicle?.capacity ?? 8));
  const [active, setActive] = useState(vehicle?.is_active ?? true);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveVehicle({ id: vehicle?.id, name, plate, capacity: Number(capacity), isActive: active }), { onSuccess: onDone });
      }}
    >
      <Field label="Naziv" htmlFor="v-name" required>
        <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="npr. Mercedes Vito" />
      </Field>
      <Field label="Registracija" htmlFor="v-plate">
        <Input id="v-plate" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={20} />
      </Field>
      <Field label="Broj mesta" htmlFor="v-cap" required>
        <Input id="v-cap" type="number" min={1} max={60} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
      </Field>
      <Switch id="v-active" checked={active} onChange={setActive} label="Aktivno" />
      <FormButtons pending={pending} onCancel={onDone} />
    </form>
  );
}

function DriverForm({ driver, onDone }: { driver: DriverRow | null; onDone: () => void }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [active, setActive] = useState(driver?.is_active ?? true);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveDriver({ id: driver?.id, name, phone, isActive: active }), { onSuccess: onDone });
      }}
    >
      <Field label="Ime i prezime" htmlFor="dr-name" required>
        <Input id="dr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </Field>
      <Field label="Telefon" htmlFor="dr-phone">
        <Input id="dr-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </Field>
      <Switch id="dr-active" checked={active} onChange={setActive} label="Aktivan" />
      <FormButtons pending={pending} onCancel={onDone} />
    </form>
  );
}

function FormButtons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-hair pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
        Odustani
      </Button>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Sačuvaj
      </Button>
    </div>
  );
}
