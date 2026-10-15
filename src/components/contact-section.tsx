import Image from "next/image";
import { Clock, Globe2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { destinations, hasReviews, isWhatsAppConfigured, siteConfig } from "@/config/site";
import { WhatsAppIcon } from "@/components/icons";
import { Eyebrow, Reveal } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";
import { getGeneralWhatsAppUrl } from "@/lib/whatsapp";

export function telHref(display: string) {
  const cleaned = display.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

const backdrop = destinations.find((d) => d.slug === "kotor") ?? destinations[0];

export function ContactSection() {
  const { contact } = siteConfig;

  const details: { label: string; value: string; href?: string; Icon: typeof Phone }[] = [
    {
      label: "WhatsApp",
      value: isWhatsAppConfigured ? `+${siteConfig.whatsapp.number}` : "Pošaljite nam poruku",
      href: getGeneralWhatsAppUrl(),
      Icon: MessageCircle,
    },
  ];
  if (contact.phone) details.push({ label: "Telefon", value: contact.phone, href: telHref(contact.phone), Icon: Phone });
  if (contact.email) details.push({ label: "E-pošta", value: contact.email, href: `mailto:${contact.email}`, Icon: Mail });
  if (contact.hours) details.push({ label: "Radno vreme", value: contact.hours, Icon: Clock });
  if (contact.address) details.push({ label: "Adresa", value: contact.address, Icon: MapPin });
  details.push({ label: "Područje usluge", value: contact.serviceArea, Icon: Globe2 });

  return (
    <section id="kontakt" aria-labelledby="contact-title" className="relative scroll-mt-20 bg-bg">
      {/* Cinematic call-to-action band */}
      <div className="section-y relative isolate overflow-hidden border-t border-hair">
        <Image
          src={backdrop.image}
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover object-[50%_40%] brightness-[0.8] saturate-[0.85]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/55 to-transparent" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-bg)_0%,transparent_30%,transparent_70%,var(--color-bg)_100%)]" />
        <div aria-hidden="true" className="grain absolute inset-0 -z-10" />

        <div className="container-page relative">
          <Reveal className="max-w-3xl">
            <Eyebrow index={hasReviews ? "07" : "06"} className="mb-8">
              Kontakt
            </Eyebrow>
            <h2
              id="contact-title"
              className="text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl"
            >
              Spremni za sledeće putovanje?
            </h2>
            <p className="mt-7 max-w-lg text-base leading-[1.7] text-fg/70 sm:text-lg">
              Pošaljite nam upit i dogovorite svoj sledeći transfer.
            </p>
            <div className="mt-10">
              <ButtonLink
                href={getGeneralWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                variant="whatsapp"
                size="lg"
                className="w-full sm:w-auto"
              >
                <WhatsAppIcon className="size-5" />
                Kontaktirajte nas putem WhatsApp-a
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="container-page pb-20 pt-4 sm:pb-24 lg:pb-28">
        <Reveal>
          <dl className="grid gap-x-12 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
            {details.map(({ label, value, href, Icon }) => (
              <div key={label} className="group border-t border-line pt-6 transition-colors duration-500 hover:border-brand/70">
                <dt className="flex items-center gap-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted">
                  <Icon className="size-4 text-fg/50" strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-4 break-words text-lg font-medium leading-snug text-fg">
                  {href ? (
                    <a
                      href={href}
                      {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="transition-colors hover:text-brand-hover"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {contact.mapEmbedUrl ? (
          <Reveal className="mt-14 overflow-hidden rounded-2xl border border-line">
            <iframe
              title="Lokacija Adriatic Trans na mapi"
              src={contact.mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-80 w-full border-0 [filter:invert(0.92)_hue-rotate(180deg)_saturate(0.7)]"
              allowFullScreen
            />
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
