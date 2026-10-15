"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WhatsAppIcon } from "@/components/icons";
import { BOOKING_SECTION_ID } from "@/components/booking-context";
import { getGeneralWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Floating WhatsApp contact button (bottom-right).
 * It tucks away while the booking form is on screen so it never covers
 * the form's controls (especially on mobile).
 */
export function WhatsAppButton() {
  const [bookingVisible, setBookingVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(BOOKING_SECTION_ID);
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setBookingVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {!bookingVisible ? (
        <motion.div
          key="wa"
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { type: "spring", stiffness: 260, damping: 22, delay: 0.6 },
          }}
          exit={{ opacity: 0, scale: 0.6, y: 20, transition: { duration: 0.2 } }}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-6 sm:right-6"
        >
          <a
            href={getGeneralWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Pišite nam na WhatsApp (otvara novu karticu)"
            className="group relative grid size-14 animate-pulse-ring place-items-center rounded-full bg-whatsapp text-white shadow-[0_14px_40px_-10px_rgb(37_211_102/0.65)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-110 active:scale-95 sm:size-16"
          >
            <WhatsAppIcon className="size-7 sm:size-8" />
            <span
              role="tooltip"
              className="pointer-events-none absolute right-full mr-4 hidden origin-right scale-95 whitespace-nowrap rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg opacity-0 shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 lg:block"
            >
              Pišite nam na WhatsApp
            </span>
          </a>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
