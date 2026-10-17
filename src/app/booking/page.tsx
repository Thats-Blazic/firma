import type { Metadata } from "next";
import { connection } from "next/server";
import { BookingFlow } from "@/components/booking-system/booking-flow";
import { BookingShell, SetupNotice } from "@/components/booking-system/booking-shell";
import { Eyebrow } from "@/components/reveal";
import { getBookingOptions, type BookingOptions } from "@/lib/reservations/public-data";
import { isBookingSystemConfigured, missingSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Online rezervacija",
  description: "Rezervišite prevoz putnika online: izaberite relaciju, slobodan termin i odmah vidite cenu.",
  alternates: { canonical: "/booking" },
};

export default async function BookingPage() {
  await connection(); // always render at request time: availability is live

  if (!isBookingSystemConfigured()) {
    return (
      <BookingShell>
        <SetupNotice missing={missingSupabaseEnv()} />
      </BookingShell>
    );
  }

  let options: BookingOptions | null = null;
  try {
    options = await getBookingOptions();
  } catch (error) {
    console.error("[booking page]", error);
  }

  return (
    <BookingShell>
      <div className="container-page py-10 sm:py-14 lg:py-16">
        <header className="mb-8 max-w-2xl sm:mb-12">
          <Eyebrow index="00" className="mb-5">
            Online rezervacija
          </Eyebrow>
          <h1 className="text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Rezervišite svoj prevoz
          </h1>
          <p className="mt-5 text-base leading-[1.7] text-muted sm:text-[1.0625rem]">
            Izaberite relaciju i slobodan termin, vidite tačnu cenu i pošaljite rezervaciju. Prikazuju se samo
            stvarno dostupni polasci.
          </p>
        </header>

        {options ? (
          <BookingFlow options={options} />
        ) : (
          <div role="alert" className="surface-raised max-w-xl rounded-2xl p-8">
            <h2 className="text-lg font-semibold">Podaci trenutno nisu dostupni</h2>
            <p className="mt-2 text-muted">
              Došlo je do greške pri učitavanju relacija. Osvežite stranicu ili pošaljite upit putem WhatsApp-a sa početne
              stranice.
            </p>
          </div>
        )}
      </div>
    </BookingShell>
  );
}
