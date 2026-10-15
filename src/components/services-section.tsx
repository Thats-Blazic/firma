import { ArrowUpRight } from "lucide-react";
import { BOOKING_SECTION_ID } from "@/components/booking-context";
import { Reveal, SectionHeading } from "@/components/reveal";

const services = [
  {
    title: "Individualni prevoz",
    description:
      "Udoban prevoz putničkim automobilom za pojedince, parove i manje grupe — od vrata do vrata, u vreme koje vama odgovara.",
  },
  {
    title: "Grupni prevoz",
    description:
      "Prevoz putnika za porodice, prijatelje i veće grupe, u zavisnosti od raspoloživosti vozila. Zajedničko putovanje bez komplikacija.",
  },
  {
    title: "Aerodromski transferi",
    description:
      "Praktično preuzimanje i dovoženje do aerodroma, dogovoreno unapred, kako biste na put krenuli bez stresa.",
  },
];

export function ServicesSection() {
  return (
    <section id="usluge" aria-labelledby="services-title" className="section-y relative scroll-mt-20 bg-bg">
      <div className="container-page">
        <SectionHeading
          index="03"
          id="services-title"
          eyebrow="Usluge"
          title="Prevoz prilagođen vašim planovima."
          description="Bilo da putujete sami, sa porodicom ili ste na putu do aerodroma — dogovorićemo prevoz po vašoj meri."
        />

        <ul className="mt-16 border-t border-line lg:mt-20">
          {services.map(({ title, description }, i) => (
            <li key={title}>
              <Reveal delay={i * 0.08} y={20}>
                <a
                  href={`#${BOOKING_SECTION_ID}`}
                  aria-label={`${title} — pošaljite upit`}
                  className="group relative grid gap-5 border-b border-line px-1 py-9 transition-colors duration-500 hover:bg-white/[0.025] sm:gap-8 sm:px-4 sm:py-11 lg:grid-cols-[6rem_minmax(0,1.1fr)_minmax(0,1.3fr)_auto] lg:items-center lg:gap-10"
                >
                  <span className="text-sm font-semibold tabular-nums tracking-[0.24em] text-muted transition-colors duration-500 group-hover:text-brand">
                    0{i + 1}
                  </span>
                  <h3 className="text-2xl font-semibold tracking-[-0.02em] text-fg transition-transform duration-500 ease-out group-hover:translate-x-1.5 sm:text-3xl lg:text-[2.125rem]">
                    {title}
                  </h3>
                  <p className="max-w-lg leading-[1.7] text-muted transition-colors duration-500 group-hover:text-fg/75">
                    {description}
                  </p>
                  <span className="flex items-center gap-3 text-sm font-semibold text-fg/80 transition-colors group-hover:text-fg">
                    <span className="lg:sr-only">Pošaljite upit</span>
                    <span
                      aria-hidden="true"
                      className="grid size-12 place-items-center rounded-full border border-line text-fg transition-[background-color,border-color,color,transform] duration-500 group-hover:border-brand group-hover:bg-brand group-hover:text-[#0b0b0b]"
                    >
                      <ArrowUpRight className="size-5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </span>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
