"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAdminAction } from "@/lib/admin/auth";
import { fail, ok } from "@/lib/admin/result";
import { normalizeText } from "@/lib/utils";
import { uuid } from "@/lib/uuid";

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\/[^\s]+$/.test(v), "Slika mora biti putanja na sajtu ili https adresa.");

const destinationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Unesite naziv (najmanje 2 karaktera).").max(80),
  country: z.string().trim().max(60).default(""),
  description: z.string().trim().max(500).default(""),
  imageUrl: imageUrl.default(""),
  isPickup: z.boolean(),
  isDestination: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(-1000).max(100000).default(0),
});

export type DestinationInput = z.input<typeof destinationSchema>;

function slugify(name: string) {
  return normalizeText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lokacija";
}

const refresh = () => revalidatePath("/admin", "layout");

export async function saveDestination(input: DestinationInput) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    const parsed = destinationSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const d = parsed.data;
    if (!d.isPickup && !d.isDestination) return fail("Lokacija mora biti polazište, destinacija, ili oboje.");

    const row = {
      name: d.name,
      country: d.country,
      description: d.description,
      image_url: d.imageUrl || null,
      is_pickup: d.isPickup,
      is_destination: d.isDestination,
      is_active: d.isActive,
      sort_order: d.sortOrder,
    };

    if (d.id) {
      const { error } = await supabase.from("destinations").update(row).eq("id", d.id);
      if (error) {
        if (error.code === "23505") return fail("Lokacija sa tim nazivom već postoji.");
        throw error;
      }
      refresh();
      return ok(undefined, "Destinacija je sačuvana.");
    }

    let slug = slugify(d.name);
    const { data: taken } = await supabase.from("destinations").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${uuid().slice(0, 4)}`;
    const { error } = await supabase.from("destinations").insert({ ...row, slug });
    if (error) {
      if (error.code === "23505") return fail("Lokacija sa tim nazivom već postoji.");
      throw error;
    }
    refresh();
    return ok(undefined, "Destinacija je dodata.");
  });
}

export async function setDestinationActive(id: string, active: boolean) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase.from("destinations").update({ is_active: active }).eq("id", id);
    if (error) throw error;
    refresh();
    return ok(undefined, active ? "Destinacija je aktivirana." : "Destinacija je sakrivena iz forme za rezervaciju.");
  });
}

/** Deletes when nothing depends on it; otherwise deactivates so booking history is never broken. */
export async function deleteDestination(id: string) {
  return runAdminAction<{ deleted: boolean }>({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { count, error: countError } = await supabase
      .from("routes")
      .select("id", { count: "exact", head: true })
      .or(`origin_id.eq.${id},destination_id.eq.${id}`);
    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      const { error } = await supabase.from("destinations").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      refresh();
      return ok({ deleted: false }, "Destinacija je deaktivirana (koristi se u relacijama), a nije obrisana.");
    }
    const { error } = await supabase.from("destinations").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        await supabase.from("destinations").update({ is_active: false }).eq("id", id);
        refresh();
        return ok({ deleted: false }, "Destinacija je deaktivirana jer je povezana sa postojećim podacima.");
      }
      throw error;
    }
    refresh();
    return ok({ deleted: true }, "Destinacija je obrisana.");
  });
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function uploadDestinationImage(formData: FormData) {
  return runAdminAction<{ url: string }>({ manager: true }, async ({ supabase }) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Izaberite sliku.");
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return fail("Dozvoljeni formati: JPG, PNG, WebP.");
    if (file.size > MAX_IMAGE_BYTES) return fail("Slika je prevelika (najviše 3 MB).");

    const path = `${uuid()}.${ext}`;
    const { error } = await supabase.storage
      .from("destination-images")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) {
      console.error("[upload]", error);
      return fail("Slika nije sačuvana. Proverite da li je Storage bucket „destination-images“ kreiran (README).");
    }
    const { data } = supabase.storage.from("destination-images").getPublicUrl(path);
    return ok({ url: data.publicUrl });
  });
}
