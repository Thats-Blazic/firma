"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, Info, Quote, Star } from "lucide-react";
import { reviewsConfig, siteConfig } from "@/config/site";
import { Reveal, SectionHeading } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function subscribe(callback: () => void) {
  const queries = [window.matchMedia("(min-width: 640px)"), window.matchMedia("(min-width: 1024px)")];
  queries.forEach((q) => q.addEventListener("change", callback));
  return () => queries.forEach((q) => q.removeEventListener("change", callback));
}

function getSnapshot() {
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

/** Number of review cards visible at once (1 / 2 / 3 by viewport width). */
function useVisibleCount() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 1);
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`Ocena ${rating} od 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("size-4", i < rating ? "fill-brand text-brand" : "text-line")}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function ReviewsSection() {
  const { items, isDemo } = reviewsConfig;
  const { google } = siteConfig;
  const visible = useVisibleCount();
  const [index, setIndex] = useState(0);

  const maxIndex = Math.max(0, items.length - visible);
  const current = Math.min(index, maxIndex);

  const go = useCallback(
    (next: number) => setIndex(Math.min(Math.max(next, 0), maxIndex)),
    [maxIndex],
  );

  const reviewHref = google.reviewUrl || google.fallbackSearchUrl;

  return (
    <section id="recenzije" aria-labelledby="reviews-title" className="section-y relative scroll-mt-20 border-t border-hair bg-bg">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index="05"
            id="reviews-title"
            eyebrow="Recenzije"
            title="Iskustva naših putnika"
            description="Poverenje se gradi kilometar po kilometar. Evo šta kažu putnici koji su putovali sa nama."
          />

          <Reveal delay={0.1} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            {google.aggregate ? (
              <p className="flex items-center gap-3 rounded-full border border-line bg-card px-5 py-2.5 text-sm">
                <Star className="size-5 fill-brand text-brand" aria-hidden="true" />
                <span className="font-extrabold text-fg">{google.aggregate.rating.toFixed(1)}</span>
                <span className="text-muted">· {google.aggregate.count} recenzija na Google-u</span>
              </p>
            ) : null}
            <ButtonLink
              href={reviewHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              className="h-auto min-h-12 max-w-full whitespace-normal py-2.5 text-center"
              aria-label={`${google.reviewUrl ? "Ostavite recenziju" : "Pogledajte recenzije"} na Google-u (otvara novu karticu)`}
            >
              {google.reviewUrl ? "Ostavite recenziju na Google-u" : "Pogledajte recenzije na Google-u"}
              <ExternalLink className="size-4" aria-hidden="true" />
            </ButtonLink>
          </Reveal>
        </div>

        {isDemo ? (
          <Reveal className="mt-12 flex items-start gap-3 border-l-2 border-brand/60 pl-4 text-sm leading-relaxed text-fg/70">
            <Info className="mt-0.5 size-4 shrink-0 text-fg/50" strokeWidth={1.5} aria-hidden="true" />
            <p>
              <strong className="font-semibold text-fg">Primer sadržaja.</strong> Kartice ispod su demonstrativne i ne
              predstavljaju stvarne recenzije. Biće zamenjene autentičnim utiscima putnika.
            </p>
          </Reveal>
        ) : null}

        <Reveal className="mt-10" aria-roledescription="carousel" aria-label="Recenzije putnika">
          <div className="-mx-2.5 -my-2 overflow-hidden py-2">
            <motion.ul
              animate={{ x: `-${current * (100 / visible)}%` }}
              transition={{ type: "spring", stiffness: 240, damping: 32 }}
              onPanEnd={(_, info) => {
                if (info.offset.x < -50) go(current + 1);
                else if (info.offset.x > 50) go(current - 1);
              }}
              style={{ touchAction: "pan-y" }}
              className="flex"
              aria-live="polite"
            >
              {items.map((review, i) => {
                const inView = i >= current && i < current + visible;
                return (
                  <li
                    key={review.id}
                    style={{ flex: `0 0 ${100 / visible}%` }}
                    className="px-2.5"
                    aria-hidden={!inView}
                    aria-roledescription="slide"
                  >
                    <article className="surface-raised relative flex h-full flex-col rounded-2xl p-7 transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-white/25 sm:p-9">
                      <div className="flex items-center justify-between">
                        <Stars rating={review.rating} />
                        <Quote className="size-7 text-white/10" strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <blockquote className="mt-7 flex-1 text-[1.0625rem] leading-[1.7] text-fg/90">
                        “{review.text}”
                      </blockquote>
                      <footer className="mt-9 flex items-center gap-4 border-t border-hair pt-6">
                        <span
                          aria-hidden="true"
                          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white/[0.05] text-xs font-semibold tracking-wider text-fg/80"
                        >
                          {review.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{review.name}</p>
                          {review.date ? <p className="text-sm text-muted">{review.date}</p> : null}
                        </div>
                        {isDemo ? (
                          <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted">
                            Demo
                          </span>
                        ) : null}
                      </footer>
                    </article>
                  </li>
                );
              })}
            </motion.ul>
          </div>

          {/* Controls sit on the left so the floating WhatsApp button (bottom-right) never covers them. */}
          <div className="mt-8 flex flex-row-reverse items-center justify-end gap-6">
            <div className="flex items-center gap-2" role="group" aria-label="Izbor recenzije">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Prikaži recenzije od ${i + 1}`}
                  aria-current={i === current}
                  onClick={() => go(i)}
                  className="group grid h-6 place-items-center px-0.5"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all duration-300",
                      i === current ? "w-8 bg-brand" : "w-3 bg-line group-hover:bg-muted",
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                aria-label="Prethodne recenzije"
                disabled={current === 0}
                onClick={() => go(current - 1)}
                className="grid size-12 place-items-center rounded-lg border border-line bg-card transition-all hover:border-white/40 hover:bg-white/[0.06] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-card"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Sledeće recenzije"
                disabled={current >= maxIndex}
                onClick={() => go(current + 1)}
                className="grid size-12 place-items-center rounded-lg border border-line bg-card transition-all hover:border-white/40 hover:bg-white/[0.06] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-card"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
