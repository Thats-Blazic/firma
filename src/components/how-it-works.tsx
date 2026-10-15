"use client";

import { motion } from "framer-motion";
import { hasReviews } from "@/config/site";
import { SectionHeading, Reveal, easeOut } from "@/components/reveal";

const steps = [
  {
    number: "01",
    title: "Izaberite destinaciju",
    text: "Odaberite mesto polaska, destinaciju i datum.",
  },
  {
    number: "02",
    title: "Pošaljite upit",
    text: "Unesite detalje putovanja i kontakt podatke.",
  },
  {
    number: "03",
    title: "Dogovorite putovanje",
    text: "Kontaktiraćemo vas putem WhatsApp-a i potvrditi detalje i cenu.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="kako-funkcionise"
      aria-labelledby="how-title"
      className="section-y relative scroll-mt-20 border-t border-hair bg-surface"
    >
      <div className="container-page">
        <SectionHeading
          index={hasReviews ? "06" : "05"}
          id="how-title"
          eyebrow="Kako funkcioniše"
          title="Do prevoza u tri jednostavna koraka."
        />

        <div className="relative mt-16 lg:mt-24">
          {/* Route line — horizontal on desktop */}
          <div aria-hidden="true" className="absolute inset-x-0 top-[0.4375rem] hidden h-px bg-line md:block" />
          <motion.div
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "0px 0px -120px 0px" }}
            transition={{ duration: 1.8, ease: easeOut, delay: 0.2 }}
            className="absolute inset-x-0 top-[0.4375rem] hidden h-px origin-left bg-gradient-to-r from-brand via-brand to-brand/0 md:block"
          />
          {/* Route line — vertical on mobile */}
          <div aria-hidden="true" className="absolute bottom-2 left-[0.4375rem] top-2 w-px bg-line md:hidden" />
          <motion.div
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: "0px 0px -120px 0px" }}
            transition={{ duration: 1.8, ease: easeOut, delay: 0.2 }}
            className="absolute bottom-2 left-[0.4375rem] top-2 w-px origin-top bg-gradient-to-b from-brand via-brand to-brand/0 md:hidden"
          />

          <ol className="relative grid gap-14 md:grid-cols-3 md:gap-10 lg:gap-16">
            {steps.map(({ number, title, text }, i) => (
              <li key={number}>
                <Reveal delay={i * 0.18} className="relative pl-10 md:pl-0 md:pt-14">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1 size-[0.9375rem] rounded-full border border-brand bg-surface md:top-0"
                  >
                    <span className="absolute inset-[3px] rounded-full bg-brand" />
                  </span>
                  <p className="text-[0.7rem] font-semibold tabular-nums tracking-[0.28em] text-brand">{number}</p>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">{title}</h3>
                  <p className="mt-3 max-w-xs leading-[1.7] text-muted">{text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
