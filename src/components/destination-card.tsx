"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import type { Destination } from "@/config/site";
import { useBooking } from "@/components/booking-context";
import { easeOut } from "@/components/reveal";
import { cn } from "@/lib/utils";

export function DestinationCard({
  destination,
  index,
  featured = false,
  className,
}: {
  destination: Destination;
  index: number;
  featured?: boolean;
  className?: string;
}) {
  const { selectDestination } = useBooking();
  const [failed, setFailed] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.9, ease: easeOut, delay: (index % 2) * 0.1 }}
      className={cn(
        // The stretched button below anchors to this element, so the whole card is clickable.
        "group relative isolate cursor-pointer overflow-hidden rounded-2xl border border-line bg-card transition-[border-color] duration-700 hover:border-white/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
        className,
      )}
    >
      {failed ? (
        // Graceful fallback if the photo cannot be loaded.
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_30%_20%,#2a1a10,#181818_60%)]"
        />
      ) : (
        <Image
          src={destination.image}
          alt={destination.imageAlt}
          fill
          sizes={
            featured
              ? "(min-width: 1024px) 50vw, 100vw"
              : "(min-width: 1280px) 25vw, (min-width: 640px) 46vw, 92vw"
          }
          onError={() => setFailed(true)}
          // Only `transform` animates (GPU-composited): a long, soft ease instead of a jumpy filter transition.
          className="-z-20 transform-gpu object-cover brightness-[0.85] saturate-[0.9] transition-transform duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.045]"
        />
      )}

      {/* Readability gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/30 to-black/25"
      />
      {/* Soft dim that lifts on hover (opacity only, so it stays smooth) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-black/20 transition-opacity duration-700 ease-out group-hover:opacity-0"
      />

      <div className="flex h-full flex-col justify-between p-5 sm:p-6">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] font-semibold tabular-nums tracking-[0.24em] text-white/70">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/80">
            <MapPin className="size-3.5 text-brand" aria-hidden="true" />
            {destination.country}
          </span>
        </div>

        {/* Bottom content: always visible, nothing shifts on hover */}
        <div>
          <h3
            className={cn(
              "font-semibold leading-[1.05] tracking-[-0.025em] text-white",
              featured ? "text-3xl sm:text-4xl lg:text-5xl" : "text-2xl",
            )}
          >
            {destination.name}
          </h3>
          <p
            className={cn(
              "mt-2.5 text-[0.9rem] leading-relaxed text-white/70",
              featured ? "max-w-md" : "line-clamp-2",
            )}
          >
            {destination.description}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4">
            <button
              type="button"
              aria-label={`Rezerviši prevoz do destinacije ${destination.name}`}
              onClick={() => selectDestination(destination.name)}
              className="cursor-pointer text-sm font-semibold text-white after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none"
            >
              Rezerviši prevoz
            </button>
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full border border-brand/70 bg-black/20 text-brand backdrop-blur-sm transition-[background-color,color,border-color] duration-500 group-hover:border-brand group-hover:bg-brand group-hover:text-[#0b0b0b]"
            >
              <ArrowRight className="size-4 transition-transform duration-500 ease-out group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
