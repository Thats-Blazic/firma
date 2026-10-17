import { destinations } from "@/config/site";
import { DestinationCard } from "@/components/destination-card";
import { Reveal, SectionHeading } from "@/components/reveal";

/** Editorial bento: the first and last destinations get larger tiles. */
function tileClass(index: number, total: number) {
  if (index === 0) return "sm:col-span-2 lg:row-span-2";
  if (index === total - 1) return "sm:col-span-2";
  return "";
}

export function DestinationsSection({ sectionIndex = "02" }: { sectionIndex?: string }) {
  return (
    <section
      id="destinacije"
      aria-labelledby="destinations-title"
      className="section-y relative scroll-mt-20 border-t border-hair bg-surface"
    >
      <div className="container-page">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index={sectionIndex}
            id="destinations-title"
            eyebrow="Destinacije"
            title="Putujte do destinacija koje volite."
          />
          <Reveal delay={0.1} className="max-w-sm">
            <p className="text-base leading-[1.7] text-muted sm:text-[1.0625rem]">
              Od planinskih predela do jadranske obale, Adrirora Travel vas vodi tamo gde želite da budete.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid auto-rows-[22rem] gap-4 sm:auto-rows-[20rem] sm:grid-cols-2 lg:mt-20 lg:auto-rows-[18.5rem] lg:grid-cols-4">
          {destinations.map((destination, index) => (
            <DestinationCard
              key={destination.slug}
              destination={destination}
              index={index}
              featured={index === 0}
              className={tileClass(index, destinations.length)}
            />
          ))}
        </div>

        <p className="mt-10 text-sm text-muted">
          Ne vidite svoju destinaciju? U obrascu za rezervaciju možete uneti bilo koje drugo mesto.
        </p>
      </div>
    </section>
  );
}
