import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";
import { isBookingSystemConfigured } from "@/lib/supabase/env";
import type { AdminRole, Settings } from "@/lib/reservations/types";
import { adminMessage } from "@/lib/reservations/errors";
import { fail, type ActionResult } from "@/lib/admin/result";

export type AdminContext = {
  userId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isManager: boolean;
  supabase: SupabaseClient;
};

export class AdminAuthError extends Error {
  constructor(public readonly kind: "unauthenticated" | "forbidden") {
    super(kind);
  }
}

/**
 * Verifies the session with Supabase (the JWT is validated server-side, not just decoded) and
 * confirms the user is listed in `admin_users`. Returns null for anyone else.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  if (!isBookingSystemConfigured()) return null;
  const supabase = await createSessionClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: admin } = await supabase
    .from("admin_users")
    .select("role,full_name,email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) return null;

  const role = admin.role as AdminRole;
  return {
    userId: user.id,
    email: admin.email || user.email || "",
    fullName: admin.full_name || "",
    role,
    isManager: role === "owner" || role === "admin",
    supabase,
  };
});

/** For pages: unauthenticated visitors are redirected; non-managers are sent back to the dashboard. */
export async function requireAdminPage(opts: { manager?: boolean } = {}): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (opts.manager && !ctx.isManager) redirect("/admin?denied=1");
  return ctx;
}

/** For server actions / route handlers: re-checks the session and role on EVERY call. */
export async function requireAdminAction(opts: { manager?: boolean } = {}): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new AdminAuthError("unauthenticated");
  if (opts.manager && !ctx.isManager) throw new AdminAuthError("forbidden");
  return ctx;
}

/**
 * Wraps an admin mutation: authenticates, authorises, and converts any failure into a
 * user-safe message (database details never reach the browser).
 */
export async function runAdminAction<T = void>(
  opts: { manager?: boolean },
  fn: (ctx: AdminContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await requireAdminAction(opts);
    return await fn(ctx);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return fail<T>(
        error.kind === "unauthenticated" ? "Sesija je istekla. Prijavite se ponovo." : "Nemate dozvolu za ovu radnju.",
      );
    }
    // Next.js control-flow errors (redirect/notFound) must pass through.
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[admin action]", error);
    return fail<T>(adminMessage(error as { message?: string; code?: string }));
  }
}

export async function loadSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as Settings;
}
