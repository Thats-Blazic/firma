"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { runAdminAction } from "@/lib/admin/auth";
import { fail, ok } from "@/lib/admin/result";
import { notifyBooking } from "@/lib/reservations/notify";
import { EMAIL_RE, normalizePhone } from "@/lib/reservations/validation";

const idSchema = z.uuid();
const refresh = () => revalidatePath("/admin", "layout");

export async function setBookingStatus(
  id: string,
  status: "pending" | "confirmed" | "cancelled" | "completed",
  reason?: string,
) {
  return runAdminAction<{ status: string }>({}, async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return fail("Neispravan zahtev.");
    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) return fail("Nevažeći status.");

    // The database function locks the trips, validates the transition and checks capacity.
    const { data, error } = await supabase.rpc("set_booking_status", {
      p_booking_id: id,
      p_status: status,
      p_reason: reason?.slice(0, 300) ?? null,
    });
    if (error) throw error;

    const row = data as { status: string };
    if (status === "confirmed" || status === "cancelled") {
      // Customer e-mail only (the admin made this change themselves); never blocks the response.
      after(() => notifyBooking(id, status, { customerOnly: true }));
    }
    refresh();
    const label = { pending: "vraćena na čekanje", confirmed: "potvrđena", cancelled: "otkazana", completed: "označena kao završena" }[status];
    return ok({ status: row.status }, `Rezervacija je ${label}.`);
  });
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Unesite ime i prezime.").max(100),
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v) => v !== "", "Unesite ispravan broj telefona sa pozivnim brojem (npr. +38161…)."),
  email: z.string().trim().max(160).refine((v) => v === "" || EMAIL_RE.test(v), "Neispravna e-adresa."),
});

export async function updateBookingContact(id: string, input: z.input<typeof contactSchema>) {
  return runAdminAction({}, async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return fail("Neispravan zahtev.");
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proverite unete podatke.");
    const { error } = await supabase
      .from("bookings")
      .update({
        customer_name: parsed.data.name,
        customer_phone: parsed.data.phone,
        customer_email: parsed.data.email || null,
      })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return ok(undefined, "Podaci o klijentu su sačuvani.");
  });
}

export async function saveInternalNotes(id: string, notes: string) {
  return runAdminAction({}, async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return fail("Neispravan zahtev.");
    const { error } = await supabase
      .from("bookings")
      .update({ internal_notes: notes.trim().slice(0, 2000) })
      .eq("id", id);
    if (error) throw error;
    refresh();
    return ok(undefined, "Interna beleška je sačuvana.");
  });
}

export type NotificationEntry = {
  id: string;
  channel: "whatsapp" | "email";
  recipient: "admin" | "customer";
  event: "created" | "confirmed" | "cancelled";
  status: "sent" | "failed" | "skipped";
  detail: string;
  created_at: string;
};

/** Delivery log of a booking's notifications, so the admin sees what was actually sent. */
export async function getBookingNotifications(id: string) {
  return runAdminAction<NotificationEntry[]>({}, async ({ supabase }) => {
    if (!idSchema.safeParse(id).success) return fail("Neispravan zahtev.");
    const { data, error } = await supabase
      .from("notifications")
      .select("id,channel,recipient,event,status,detail,created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return ok((data ?? []) as NotificationEntry[]);
  });
}
