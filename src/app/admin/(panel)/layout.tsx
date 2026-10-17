import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminContext } from "@/lib/admin/auth";
import { isBookingSystemConfigured, missingSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: { default: "Administracija", template: "%s | Administracija" },
  robots: { index: false, follow: false },
};

const ROLE_LABELS = { owner: "Vlasnik", admin: "Administrator", staff: "Operater" } as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await connection();

  if (!isBookingSystemConfigured()) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-4">
        <div role="alert" className="surface-raised max-w-lg rounded-2xl p-8">
          <h1 className="text-xl font-semibold">Sistem nije podešen</h1>
          <p className="mt-3 text-sm text-muted">
            Nedostaju promenljive okruženja: <code>{missingSupabaseEnv().join(", ")}</code>. Pogledajte README (odeljak
            „Baza podataka“) za tačne korake.
          </p>
          <Link href="/" className="mt-5 inline-block text-sm font-semibold text-brand underline underline-offset-4">
            Nazad na sajt
          </Link>
        </div>
      </main>
    );
  }

  // Authoritative server-side check on every request (the proxy is only a first filter).
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  return (
    <AdminShell email={ctx.email} role={ROLE_LABELS[ctx.role]} isManager={ctx.isManager}>
      {children}
    </AdminShell>
  );
}
