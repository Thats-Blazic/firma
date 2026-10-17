"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAdminAction } from "@/lib/admin/auth";
import { fail, ok } from "@/lib/admin/result";
import { EMAIL_RE } from "@/lib/reservations/validation";

const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "Unesite naziv firme.").max(80),
  companyPhone: z.string().trim().max(30),
  companyEmail: z.string().trim().max(120).refine((v) => v === "" || EMAIL_RE.test(v), "Neispravna e-adresa firme."),
  companyAddress: z.string().trim().max(200),
  adminPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 8 && v.length <= 15), "Broj za obaveštenja unesite u međunarodnom formatu (npr. 381612378859)."),
  adminEmail: z.string().trim().max(120).refine((v) => v === "" || EMAIL_RE.test(v), "Neispravna e-adresa administratora."),
  confirmationMode: z.enum(["auto", "manual"]),
  minAdvanceHours: z.number().int().min(0).max(24 * 90),
  maxBookingWindowDays: z.number().int().min(1).max(730),
  defaultCapacity: z.number().int().min(1).max(60),
  cancellationPolicy: z.string().trim().max(2000),
  notifyAdminWhatsapp: z.boolean(),
  notifyAdminEmail: z.boolean(),
  notifyCustomerEmail: z.boolean(),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Neispravna vremenska zona."),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(input: SettingsInput) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const s = parsed.data;
    const { error } = await supabase
      .from("settings")
      .update({
        company_name: s.companyName,
        company_phone: s.companyPhone,
        company_email: s.companyEmail,
        company_address: s.companyAddress,
        admin_phone: s.adminPhone,
        admin_email: s.adminEmail,
        confirmation_mode: s.confirmationMode,
        min_advance_hours: s.minAdvanceHours,
        max_booking_window_days: s.maxBookingWindowDays,
        default_capacity: s.defaultCapacity,
        cancellation_policy: s.cancellationPolicy,
        notify_admin_whatsapp: s.notifyAdminWhatsapp,
        notify_admin_email: s.notifyAdminEmail,
        notify_customer_email: s.notifyCustomerEmail,
        timezone: s.timezone,
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return ok(undefined, "Podešavanja su sačuvana.");
  });
}

// ---------------------------------------------------------------------------
//  Vehicles and drivers
// ---------------------------------------------------------------------------
const vehicleSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Unesite naziv vozila.").max(80),
  plate: z.string().trim().max(20).default(""),
  capacity: z.number().int().min(1).max(60),
  isActive: z.boolean(),
});
const driverSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Unesite ime vozača.").max(80),
  phone: z.string().trim().max(30).default(""),
  isActive: z.boolean(),
});

export async function saveVehicle(input: z.input<typeof vehicleSchema>) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    const parsed = vehicleSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const v = parsed.data;
    const row = { name: v.name, plate: v.plate, capacity: v.capacity, is_active: v.isActive };
    const { error } = v.id ? await supabase.from("vehicles").update(row).eq("id", v.id) : await supabase.from("vehicles").insert(row);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return ok(undefined, "Vozilo je sačuvano.");
  });
}

export async function deleteVehicle(id: string) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return ok(undefined, "Vozilo je obrisano. Polasci koji su ga koristili ostaju bez dodeljenog vozila.");
  });
}

export async function saveDriver(input: z.input<typeof driverSchema>) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    const parsed = driverSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const d = parsed.data;
    const row = { name: d.name, phone: d.phone, is_active: d.isActive };
    const { error } = d.id ? await supabase.from("drivers").update(row).eq("id", d.id) : await supabase.from("drivers").insert(row);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return ok(undefined, "Vozač je sačuvan.");
  });
}

export async function deleteDriver(id: string) {
  return runAdminAction({ manager: true }, async ({ supabase }) => {
    if (!z.uuid().safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin", "layout");
    return ok(undefined, "Vozač je obrisan.");
  });
}
