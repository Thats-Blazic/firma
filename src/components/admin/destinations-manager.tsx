"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, ImagePlus, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteDestination, saveDestination, setDestinationActive, uploadDestinationImage } from "@/app/admin/actions/destinations";
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, Switch, useRunner, useToast } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { DestinationRow } from "@/lib/reservations/types";

export function DestinationsManager({ destinations, usage, canManage }: { destinations: DestinationRow[]; usage: Record<string, number>; canManage: boolean }) {
  const { run, pending } = useRunner();
  const [editing, setEditing] = useState<DestinationRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DestinationRow | null>(null);

  return (
    <>
      <PageHeader
        title="Destinacije"
        description="Mesta koja putnici biraju kao polazište i odredište. Cene se podešavaju u delu „Relacije“."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Nova destinacija
            </Button>
          ) : null
        }
      />

      {destinations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-5" aria-hidden="true" />}
          title="Još nema destinacija"
          description="Dodajte aerodrome, gradove ili hotele koje opslužujete. Bez destinacija forma za rezervaciju nije dostupna."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" aria-hidden="true" />
                Nova destinacija
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {destinations.map((d) => (
            <li key={d.id} className={`surface-raised flex flex-col rounded-2xl p-4 ${d.is_active ? "" : "opacity-60"}`}>
              <div className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-field">
                  {d.image_url ? (
                    <Image src={d.image_url} alt="" fill sizes="64px" unoptimized className="object-cover" />
                  ) : (
                    <MapPin className="absolute inset-0 m-auto size-6 text-muted" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{d.name}</p>
                  <p className="truncate text-xs text-muted">{d.country || "—"}</p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    {d.is_pickup ? <span className="rounded-full bg-white/10 px-2 py-0.5">Polazište</span> : null}
                    {d.is_destination ? <span className="rounded-full bg-white/10 px-2 py-0.5">Destinacija</span> : null}
                    {!d.is_active ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-danger">Neaktivna</span> : null}
                  </p>
                </div>
              </div>
              {d.description ? <p className="mt-3 line-clamp-2 text-sm text-muted">{d.description}</p> : null}
              <p className="mt-3 text-xs text-muted">
                Redosled: {d.sort_order} · u {usage[d.id] ?? 0} relacija
              </p>
              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hair pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditing(d)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Izmeni
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => setDestinationActive(d.id, !d.is_active))}
                  >
                    {d.is_active ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                    {d.is_active ? "Sakrij" : "Aktiviraj"}
                  </Button>
                  <Button variant="outline" size="sm" className="text-danger" onClick={() => setDeleting(d)} aria-label={`Obriši ${d.name}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nova destinacija" : "Izmeni destinaciju"}
        size="lg"
      >
        {editing !== null ? (
          <DestinationForm key={editing === "new" ? "new" : editing.id} destination={editing === "new" ? null : editing} nextOrder={destinations.length * 10 + 10} onDone={() => setEditing(null)} />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Obrisati destinaciju?"
        description={
          deleting ? (
            (usage[deleting.id] ?? 0) > 0 ? (
              <>
                <strong className="text-fg">{deleting.name}</strong> se koristi u {usage[deleting.id]} relacija, pa neće biti obrisana — biće samo sakrivena iz forme za rezervaciju.
                Postojeće rezervacije ostaju netaknute.
              </>
            ) : (
              <>
                <strong className="text-fg">{deleting.name}</strong> nije povezana ni sa jednom relacijom i biće trajno obrisana.
              </>
            )
          ) : null
        }
        confirmLabel={deleting && (usage[deleting.id] ?? 0) > 0 ? "Deaktiviraj" : "Obriši"}
        pending={pending}
        onConfirm={() =>
          deleting &&
          run(() => deleteDestination(deleting.id), {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </>
  );
}

function DestinationForm({ destination, nextOrder, onDone }: { destination: DestinationRow | null; nextOrder: number; onDone: () => void }) {
  const { run, pending } = useRunner();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState(destination?.name ?? "");
  const [country, setCountry] = useState(destination?.country ?? "");
  const [description, setDescription] = useState(destination?.description ?? "");
  const [imageUrl, setImageUrl] = useState(destination?.image_url ?? "");
  const [isPickup, setIsPickup] = useState(destination?.is_pickup ?? true);
  const [isDestination, setIsDestination] = useState(destination?.is_destination ?? true);
  const [isActive, setIsActive] = useState(destination?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(destination?.sort_order ?? nextOrder));

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadDestinationImage(fd);
      if (res.ok) {
        setImageUrl(res.data.url);
        toast.success("Slika je otpremljena. Sačuvajte destinaciju da bi se primenila.");
      } else toast.error(res.error);
    } catch {
      toast.error("Otpremanje nije uspelo. Proverite vezu i pokušajte ponovo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveDestination({
              id: destination?.id,
              name,
              country,
              description,
              imageUrl,
              isPickup,
              isDestination,
              isActive,
              sortOrder: Number(sortOrder) || 0,
            }),
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Naziv" htmlFor="d-name" required>
          <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </Field>
        <Field label="Država" htmlFor="d-country">
          <Input id="d-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} placeholder="npr. Crna Gora" />
        </Field>
        <Field label="Opis" htmlFor="d-desc" className="sm:col-span-2">
          <Textarea id="d-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Field>

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-semibold">Slika (opciono)</p>
          <div className="flex items-center gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-field">
              {imageUrl ? <Image src={imageUrl} alt="Pregled slike" fill sizes="80px" unoptimized className="object-cover" /> : <ImagePlus className="absolute inset-0 m-auto size-6 text-muted" aria-hidden="true" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id="d-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
                {imageUrl ? "Zameni sliku" : "Otpremi sliku"}
              </Button>
              {imageUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>
                  Ukloni
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted">JPG, PNG ili WebP, do 3 MB.</p>
        </div>

        <Field label="Redosled prikaza" htmlFor="d-order" hint="Manji broj se prikazuje prvi.">
          <Input id="d-order" type="number" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="space-y-4 sm:pt-1">
          <Switch id="d-pickup" checked={isPickup} onChange={setIsPickup} label="Može biti polazište" />
          <Switch id="d-dest" checked={isDestination} onChange={setIsDestination} label="Može biti destinacija" />
          <Switch id="d-active" checked={isActive} onChange={setIsActive} label="Aktivna" description="Neaktivne lokacije se ne prikazuju putnicima." />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-hair pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Odustani
        </Button>
        <Button type="submit" size="sm" disabled={pending || uploading}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Sačuvaj
        </Button>
      </div>
    </form>
  );
}
