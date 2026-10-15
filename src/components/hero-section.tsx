"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Armchair, ArrowRight, CalendarCheck, CalendarClock } from "lucide-react";
import { heroImage } from "@/config/site";
import { BOOKING_SECTION_ID } from "@/components/booking-context";
import { Eyebrow, easeOut } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.25 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 1, ease: easeOut } },
};

const trust = [
  { label: "Udoban prevoz", Icon: Armchair },
  { label: "Fleksibilni termini", Icon: CalendarClock },
  { label: "Jednostavna rezervacija", Icon: CalendarCheck },
];

export function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  return (
    <section
      id="pocetna"
      ref={ref}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-bg"
    >
      {/* Photography: slow push-in on load, subtle parallax on scroll */}
      <motion.div
        style={{ y: imageY }}
        className="absolute inset-x-0 top-0 -z-20 h-[62svh] lg:-top-[6%] lg:left-[8%] lg:right-[-2%] lg:h-[112%] lg:inset-x-auto"
      >
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.8, ease: easeOut }}
          className="absolute inset-0"
        >
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            priority
            sizes="(min-width: 1024px) 85vw, 100vw"
            className="-scale-x-100 object-cover object-[66%_58%] brightness-[0.85] contrast-[1.08] saturate-[0.8] lg:object-[100%_60%]"
          />
        </motion.div>
        {/* Feather the photograph into the page background */}
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-bg)_0%,transparent_46%)] lg:hidden" />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[linear-gradient(to_right,var(--color-bg)_0%,rgb(11_11_11/0.7)_20%,rgb(11_11_11/0.2)_42%,transparent_58%)] lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(11_11_11/0.55)_0%,transparent_30%)]"
        />
      </motion.div>

      {/* Cinematic grade: deep falloff into the page, soft vignette, fine grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-[linear-gradient(to_right,var(--color-bg)_0%,var(--color-bg)_6%,transparent_34%)] lg:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(110%_90%_at_72%_55%,transparent_45%,rgb(11_11_11/0.7)_100%)]"
      />
      <div aria-hidden="true" className="grain absolute inset-0 -z-10" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="container-page relative flex flex-1 items-end pb-14 pt-[22rem] sm:pb-16 sm:pt-[26rem] lg:items-center lg:pb-20 lg:pt-40"
      >
        <motion.div variants={container} initial="hidden" animate="show" className="max-w-[44rem]">
          <motion.div variants={item}>
            <Eyebrow className="mb-8 text-fg/70">
              <span className="sm:hidden">Srbija i Crna Gora</span>
              <span className="hidden sm:inline">Prevoz putnika · Srbija i Crna Gora</span>
            </Eyebrow>
          </motion.div>

          <h1
            id="hero-title"
            className="text-[2.9rem] font-semibold leading-[1] tracking-[-0.04em] text-fg sm:text-6xl lg:text-7xl xl:text-[5.5rem]"
          >
            <motion.span variants={item} className="block">
              Vaše putovanje.
            </motion.span>
            <motion.span variants={item} className="block text-brand">
              Naš prioritet.
            </motion.span>
          </h1>

          <motion.p variants={item} className="mt-8 max-w-md text-base leading-[1.75] text-fg/70 sm:text-lg">
            Udoban i pouzdan prevoz do vaših omiljenih destinacija. Vi birate pravac, mi brinemo o putovanju.
          </motion.p>

          <motion.div variants={item} className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <ButtonLink href={`#${BOOKING_SECTION_ID}`} size="lg">
              Rezerviši prevoz
              <ArrowRight
                className="size-[1.1rem] transition-transform duration-300 group-hover/btn:translate-x-1"
                aria-hidden="true"
              />
            </ButtonLink>
            <ButtonLink href="#destinacije" variant="outline" size="lg">
              Istraži destinacije
            </ButtonLink>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Spec strip */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: easeOut, delay: 1 }}
        className="relative border-t border-white/10 bg-bg/40 backdrop-blur-[2px]"
      >
        <ul className="container-page grid sm:grid-cols-3">
          {trust.map(({ label, Icon }, i) => (
            <li
              key={label}
              className="flex items-center gap-4 border-b border-white/10 py-4 last:border-b-0 sm:border-b-0 sm:border-l sm:px-8 sm:py-7 sm:first:border-l-0 sm:first:pl-0"
            >
              <span className="text-[0.7rem] font-semibold tabular-nums tracking-[0.2em] text-brand">0{i + 1}</span>
              <Icon className="size-[1.15rem] text-fg/50" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm font-medium text-fg/90">{label}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
