/**
 * Supabase environment access. The anon key is public by design (it is protected by
 * Row Level Security and this app never queries the database from the browser).
 * The service-role key is read ONLY in `service.ts`, which is marked `server-only`.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** True when the booking system has everything it needs to run. */
export function isBookingSystemConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Names of the missing variables, for clear setup messages. */
export function missingSupabaseEnv(): string[] {
  return ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (key) => !process.env[key],
  );
}
