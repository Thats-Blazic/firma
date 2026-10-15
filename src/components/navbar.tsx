"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { navItems } from "@/config/site";
import { BOOKING_SECTION_ID } from "@/components/booking-context";
import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(navItems[0].id);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  // Highlight the nav item for the section currently in view.
  useEffect(() => {
    // Sections that are not nav items are observed too, so the highlight is
    // cleared while they are on screen instead of keeping a stale one.
    const navIds = new Set(navItems.map((item) => item.id));
    const elements = [...document.querySelectorAll<HTMLElement>("main section[id]")];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          const id = visible[visible.length - 1].target.id;
          setActive(navIds.has(id) ? id : "");
        }
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Lock page scroll + close on Escape while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu if the viewport grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        open
          ? "border-line bg-bg"
          : scrolled
            ? "border-white/[0.08] bg-bg/80 backdrop-blur-xl"
            : "border-transparent bg-gradient-to-b from-black/55 to-transparent",
      )}
    >
      <nav
        aria-label="Glavna navigacija"
        className={cn(
          "container-page flex items-center justify-between gap-6 transition-[height] duration-300",
          scrolled ? "h-[4.25rem]" : "h-20",
        )}
      >
        <a href="#pocetna" aria-label="Adriatic Trans — početna" className="rounded-xl">
          <Wordmark />
        </a>

        <ul className="hidden items-center gap-2 lg:flex">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "group relative block px-3.5 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em] transition-colors duration-300",
                    isActive ? "text-fg" : "text-fg/60 hover:text-fg",
                  )}
                >
                  {item.label}
                  {isActive ? (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute inset-x-3.5 -bottom-px h-px bg-brand"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : (
                    <span className="absolute inset-x-3.5 -bottom-px h-px origin-left scale-x-0 bg-white/50 transition-transform duration-500 ease-out group-hover:scale-x-100" />
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-3">
          <ButtonLink href={`#${BOOKING_SECTION_ID}`} size="sm" className="hidden sm:inline-flex">
            Rezerviši prevoz
          </ButtonLink>

          <button
            type="button"
            aria-label={open ? "Zatvori meni" : "Otvori meni"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-lg border border-white/15 bg-white/[0.04] text-fg transition-colors hover:border-white/40 lg:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "close" : "open"}
                initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100dvh - 5rem)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line bg-bg lg:hidden"
          >
            <ul className="container-page flex h-full flex-col gap-1 overflow-y-auto py-5">
              {navItems.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.25 }}
                >
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active === item.id ? "true" : undefined}
                    className={cn(
                      "flex items-center justify-between border-b border-hair px-1 py-5 text-2xl font-semibold tracking-tight transition-colors",
                      active === item.id ? "text-brand" : "text-fg hover:text-brand-hover",
                    )}
                  >
                    {item.label}
                    {active === item.id ? <span aria-hidden="true" className="size-2 rounded-full bg-brand" /> : null}
                  </a>
                </motion.li>
              ))}
              <motion.li
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.25 }}
                className="pt-3"
              >
                <ButtonLink
                  href={`#${BOOKING_SECTION_ID}`}
                  onClick={() => setOpen(false)}
                  size="lg"
                  className="w-full"
                >
                  Rezerviši prevoz
                </ButtonLink>
              </motion.li>
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
