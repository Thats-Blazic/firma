import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/app/admin/login/login-form";
import { Wordmark } from "@/components/wordmark";
import { getAdminContext } from "@/lib/admin/auth";
import { isBookingSystemConfigured, missingSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Prijava administratora",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const { next } = await searchParams;
  const configured = isBookingSystemConfigured();

  if (configured && (await getAdminContext())) redirect(next?.startsWith("/admin") ? next : "/admin");

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <div className="surface-raised rounded-2xl p-6 sm:p-9">
          <h1 className="text-2xl font-semibold tracking-tight">Administratorski panel</h1>
          <p className="mt-1.5 mb-7 text-sm text-muted">Prijavite se da upravljate rezervacijama i polascima.</p>
          {configured ? (
            <LoginForm next={next ?? "/admin"} />
          ) : (
            <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
              Sistem nije podešen. Nedostaju promenljive okruženja: <code>{missingSupabaseEnv().join(", ")}</code>.
              Pogledajte README (odeljak „Baza podataka“).
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="underline underline-offset-4 hover:text-fg">
            Nazad na sajt
          </Link>
        </p>
      </div>
    </main>
  );
}
