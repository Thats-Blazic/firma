import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { siteConfig } from "@/config/site";
import { telHref } from "@/components/contact-section";

/** Light page chrome shared by /booking and the confirmation page (the home navbar uses #anchors). */
export function BookingShell({ children }: { children: React.ReactNode }) {
  const { contact } = siteConfig;
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-hair bg-bg/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
          <Link href="/" aria-label="Adrirora Travel — početna" className="rounded-md">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2 sm:gap-5">
            {contact.phone ? (
              <a
                href={telHref(contact.phone)}
                className="hidden items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-fg sm:inline-flex"
              >
                <Phone className="size-4 text-brand" aria-hidden="true" />
                {contact.phone}
              </a>
            ) : null}
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-[0.8125rem] font-semibold text-fg transition-colors hover:border-white/40 hover:bg-white/[0.05]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Nazad na sajt</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="glavni-sadrzaj">{children}</main>
      <footer className="border-t border-hair py-8">
        <p className="container-page text-center text-xs text-muted">
          © {new Date().getFullYear()} {siteConfig.name}. Sva prava zadržana.
        </p>
      </footer>
    </div>
  );
}

export function SetupNotice({ missing }: { missing: string[] }) {
  const { contact } = siteConfig;
  return (
    <div className="container-page py-24">
      <div className="surface-raised mx-auto max-w-xl rounded-2xl p-8 text-center sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Online rezervacije uskoro</h1>
        <p className="mt-4 text-muted">
          Online rezervacija trenutno nije dostupna. Pošaljite upit putem WhatsApp-a sa početne stranice
          {contact.phone ? <> ili nas pozovite na <a className="font-semibold text-fg underline underline-offset-4" href={telHref(contact.phone)}>{contact.phone}</a></> : null}.
        </p>
        {process.env.NODE_ENV !== "production" && missing.length > 0 ? (
          <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-sm text-amber-200">
            Razvojno upozorenje: nedostaju promenljive okruženja: <code>{missing.join(", ")}</code>. Pogledajte README
            (odeljak „Baza podataka“).
          </p>
        ) : null}
        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-brand underline underline-offset-4">
          Nazad na početnu stranicu
        </Link>
      </div>
    </div>
  );
}
