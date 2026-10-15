import Image from "next/image";
import { Armchair, CalendarClock, Headset, MessageCircle, MessageSquareText, Route } from "lucide-react";
import { heroImage } from "@/config/site";
import { Reveal, SectionHeading } from "@/components/reveal";

const benefits = [
  {
    title: "Udobnost tokom putovanja",
    text: "Opušteno putovanje u udobnom vozilu, bez brige o pravcu i parkingu.",
    Icon: Armchair,
  },
  {
    title: "Jednostavna komunikacija",
    text: "Jasne informacije i brz dogovor, bez komplikovanih formulara.",
    Icon: MessageSquareText,
  },
  {
    title: "Dogovor oko termina",
    text: "Vreme polaska usklađujemo sa vašim planovima, u skladu sa raspoloživošću.",
    Icon: CalendarClock,
  },
  {
    title: "Prevoz prema vašim potrebama",
    text: "Birate pravac, datum i broj putnika — a mi brinemo o ostalom.",
    Icon: Route,
  },
  {
    title: "Direktna komunikacija sa prevoznikom",
    text: "Sve detalje putovanja dogovarate direktno sa onima koji vas voze.",
    Icon: Headset,
  },
  {
    title: "Jednostavna rezervacija putem WhatsApp-a",
    text: "Pošaljite upit u nekoliko koraka, a odgovor stiže putem WhatsApp-a.",
    Icon: MessageCircle,
  },
];

export function WhyChooseUs() {
  return (
    <section
      id="zasto-mi"
      aria-labelledby="why-title"
      className="section-y relative scroll-mt-20 border-t border-hair bg-surface"
    >
      <div className="container-page grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            index="04"
            id="why-title"
            eyebrow="Zašto mi"
            title="Zašto odabrati Adriatic Trans?"
            description="Putovanje treba da bude jednostavno. Zato se trudimo da svaki korak — od upita do polaska — bude jasan i prijatan."
          />

          {/* Detail crop of the hero photograph */}
          <Reveal delay={0.15} className="mt-12 hidden lg:block">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line">
              <Image
                src={heroImage.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 40vw, 0px"
                className="origin-[56%_56%] scale-[3.1] object-cover brightness-[0.75] contrast-[1.1] saturate-[0.8]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-transparent" />
              <div aria-hidden="true" className="grain absolute inset-0" />
            </div>
          </Reveal>
        </div>

        <ul className="grid content-start gap-x-12 gap-y-0 sm:grid-cols-2">
          {benefits.map(({ title, text, Icon }, i) => (
            <li key={title}>
              <Reveal
                delay={(i % 2) * 0.08}
                className="group h-full border-t border-line py-9 transition-colors duration-500 hover:border-brand/70"
              >
                <Icon
                  className="size-7 text-fg/55 transition-colors duration-500 group-hover:text-brand"
                  strokeWidth={1.25}
                  aria-hidden="true"
                />
                <h3 className="mt-7 text-xl font-semibold leading-snug tracking-[-0.015em]">{title}</h3>
                <p className="mt-3 text-[0.95rem] leading-[1.7] text-muted">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
