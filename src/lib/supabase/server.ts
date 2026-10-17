import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

/**
 * Client that acts as the signed-in administrator (anon key + the user's session cookie).
 * All queries run under Row Level Security, so the database itself enforces admin-only access.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("SUPABASE_NOT_CONFIGURED");
  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component (cookies are read-only there); the proxy refreshes the session.
        }
      },
    },
  });
}
