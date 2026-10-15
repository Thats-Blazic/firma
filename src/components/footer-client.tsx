"use client";

import { BOOKING_SECTION_ID, useBooking } from "@/components/booking-context";

/** Footer destination link: prefills the booking form and scrolls to it. */
export function FooterDestinationLink({ name }: { name: string }) {
  const { selectDestination } = useBooking();
  return (
    <a
      href={`#${BOOKING_SECTION_ID}`}
      onClick={(e) => {
        e.preventDefault();
        selectDestination(name);
      }}
      className="inline-block py-1 text-muted transition-colors hover:text-fg"
    >
      {name}
    </a>
  );
}

/** Rendered on the client so the year is always current, not frozen at build time. */
export function CurrentYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
