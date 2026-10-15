"use client";

import { MotionConfig } from "framer-motion";
import { BookingProvider } from "@/components/booking-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // `reducedMotion="user"` makes every Framer Motion animation honour the
    // visitor's `prefers-reduced-motion` setting (transforms are disabled).
    <MotionConfig reducedMotion="user">
      <BookingProvider>{children}</BookingProvider>
    </MotionConfig>
  );
}
