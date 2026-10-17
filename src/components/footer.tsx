import Link from "next/link";
import { Clock, Mail, Phone } from "lucide-react";
import { destinations, heroImage, navItems, siteConfig } from "@/config/site";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { CurrentYear, FooterDestinationLink } from "@/components/footer-client";
import { telHref } from "@/components/contact-section";
import { Wordmark } from "@/components/wordmark";
import { getGeneralWhatsAppUrl } from "@/lib/whatsapp";

const footerHeading = "mb-6 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-fg/50";

export function Footer() {
  const { contact, social } = siteConfig;
  const popular = destinations.slice(0, 6);

  const socials = [
    { label: "Instagram", href: social.instagram, Icon: InstagramIcon },
    { label: "Facebook", href: social.facebook, Icon: FacebookIcon },
  ].filter((s) => s.href);

  return (
    <footer className="relative border-t border-line bg-surface">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent"
      />

      <div className="container-page grid gap-12 py-20 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
        <div>
          <Link href="/#pocetna" aria-label="Adrirora Travel — na vrh stranice" className="inline-block rounded-xl">
            <Wordmark />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Prevoz putnika putničkim automobilom do destinacija u Srbiji i Crnoj Gori. Vi birate pravac, mi
            brinemo o putovanju.
          </p>

          {socials.length > 0 ? (
            <ul className="mt-6 flex gap-3">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (otvara novu karticu)`}
                    className="grid size-10 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-white/40 hover:text-fg"
                  >
                    <Icon className="size-[1.15rem]" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <nav aria-label="Navigacija u podnožju">
          <h2 className={footerHeading}>Navigacija</h2>
          <ul className="space-y-1 text-sm">
            {navItems.map((item) => (
              <li key={item.id}>
                <a href={`/${item.href}`} className="inline-block py-1 text-muted transition-colors hover:text-fg">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={footerHeading}>Popularne destinacije</h2>
          <ul className="space-y-1 text-sm">
            {popular.map((d) => (
              <li key={d.slug}>
                <FooterDestinationLink name={d.name} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className={footerHeading}>Kontakt</h2>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href={getGeneralWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 font-semibold text-whatsapp transition-opacity hover:opacity-80"
              >
                <WhatsAppIcon className="size-5" />
                Pišite nam na WhatsApp
              </a>
            </li>
            {contact.phone ? (
              <li>
                <a
                  href={telHref(contact.phone)}
                  className="inline-flex items-center gap-2.5 text-muted transition-colors hover:text-fg"
                >
                  <Phone className="size-4 text-fg/50" aria-hidden="true" />
                  {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.email ? (
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-2.5 text-muted transition-colors hover:text-fg"
                >
                  <Mail className="size-4 text-fg/50" aria-hidden="true" />
                  {contact.email}
                </a>
              </li>
            ) : null}
            {contact.hours ? (
              <li className="flex items-center gap-2.5 text-muted">
                <Clock className="size-4 text-fg/50" aria-hidden="true" />
                {contact.hours}
              </li>
            ) : null}
            <li className="max-w-xs leading-relaxed text-muted">{contact.serviceArea}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CurrentYear /> {siteConfig.name}. Sva prava zadržana.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 sm:mr-20">
            <a href={siteConfig.privacyPath} className="w-fit transition-colors hover:text-fg">
              Politika privatnosti
            </a>
            <span className="hidden h-3 w-px bg-line sm:block" aria-hidden="true" />
            <p>
              Designed by{" "}
              <a
                href="https://www.instagram.com/ghostforcedesign/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-fg/80 underline-offset-4 transition-colors hover:text-brand hover:underline"
              >
                Ghost Force Studio
              </a>
            </p>
          </div>
        </div>

        <details className="container-page pb-6 text-xs text-muted/80">
          <summary className="w-fit cursor-pointer rounded transition-colors hover:text-muted">
            Kreditovanje fotografija
          </summary>
          <ul className="mt-3 space-y-1 leading-relaxed">
            <li>
              Naslovna fotografija: {heroImage.credit.author} ({heroImage.credit.license}),{" "}
              <a className="underline underline-offset-2" href={heroImage.credit.source} target="_blank" rel="noopener noreferrer">
                Unsplash
              </a>
              .
            </li>
            {destinations.map((d) => (
              <li key={d.slug}>
                {d.name}: {d.credit.author} ({d.credit.license}),{" "}
                <a className="underline underline-offset-2" href={d.credit.source} target="_blank" rel="noopener noreferrer">
                  Wikimedia Commons
                </a>
                .
              </li>
            ))}
          </ul>
        </details>
      </div>
    </footer>
  );
}
