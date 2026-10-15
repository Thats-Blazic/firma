"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Prefill = { destination: string; nonce: number } | null;

type BookingContextValue = {
  /** Latest destination chosen from a card elsewhere on the page. */
  prefill: Prefill;
  /** Prefills the booking form's destination and scrolls to the form. */
  selectDestination: (destination: string) => void;
};

const BookingContext = createContext<BookingContextValue | null>(null);

export const BOOKING_SECTION_ID = "rezervacija";

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [prefill, setPrefill] = useState<Prefill>(null);
  const router = useRouter();

  const selectDestination = useCallback((destination: string) => {
    setPrefill({ destination, nonce: Date.now() });

    const target = document.getElementById(BOOKING_SECTION_ID);
    if (!target) {
      // Not on the home page (e.g. privacy policy) → go to the booking form.
      router.push(`/#${BOOKING_SECTION_ID}`);
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Keep the URL hash in sync without triggering a second jump.
    window.history.replaceState(null, "", `#${BOOKING_SECTION_ID}`);
  }, [router]);

  const value = useMemo(() => ({ prefill, selectDestination }), [prefill, selectDestination]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside <BookingProvider>");
  return ctx;
}
