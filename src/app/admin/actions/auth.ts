"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { isBookingSystemConfigured } from "@/lib/supabase/env";
import { rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

/** Only same-site /admin paths are valid post-login destinations (prevents open redirects). */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") && !next.includes("\\") ? next : "/admin";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isBookingSystemConfigured()) return { error: "Sistem nije podešen. Pogledajte README (Baza podataka)." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Unesite ispravnu e-adresu i lozinku." };

  if (!rateLimit(`login-ip:${ip}`, 10, 10 * 60_000) || !rateLimit(`login:${parsed.data.email}`, 6, 10 * 60_000)) {
    return { error: "Previše pokušaja prijave. Pokušajte ponovo za nekoliko minuta." };
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Pogrešna e-adresa ili lozinka." };

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "Ovaj nalog nema pristup administratorskom panelu." };
  }

  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  if (isBookingSystemConfigured()) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
