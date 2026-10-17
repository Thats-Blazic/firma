import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";
import { Wordmark } from "@/components/wordmark";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Kako Adrirora Travel postupa sa podacima koje ostavite prilikom slanja upita za prevoz.",
  alternates: { canonical: "/politika-privatnosti" },
};

export default function PrivacyPage() {
  const { contact } = siteConfig;

  return (
    <>
      <header className="border-b border-line bg-bg">
        <div className="container-page flex h-[4.5rem] items-center justify-between">
          <Link href="/" aria-label="Adrirora Travel — početna" className="rounded-xl">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-brand-hover"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Nazad na početnu
          </Link>
        </div>
      </header>

      <main className="bg-bg py-16 sm:py-24">
        <article className="container-page max-w-3xl">
          <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-brand">
            <span aria-hidden="true" className="h-px w-8 bg-brand" />
            Pravne informacije
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Politika privatnosti</h1>
          <p className="mt-5 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4 text-sm text-fg/80">
            Ovo je osnovni tekst koji opisuje kako ovaj sajt funkcioniše. Pre objave ga uskladite sa stvarnim poslovanjem
            i važećim propisima (po potrebi uz pravni savet).
          </p>

          <div className="mt-10 space-y-9 text-muted [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_p]:leading-relaxed">
            <section>
              <h2>Koje podatke prikupljamo</h2>
              <p>
                Prilikom popunjavanja obrasca za rezervaciju unosite ime i prezime, broj telefona, mesto polaska,
                destinaciju, datume putovanja, broj putnika, tip vozila i, opciono, dodatne napomene.
              </p>
            </section>
            <section>
              <h2>Kako se podaci koriste</h2>
              <p>
                Podaci iz obrasca se ne čuvaju na serveru ovog sajta. Oni se koriste isključivo da bi se sastavila poruka
                koja se otvara u aplikaciji WhatsApp, a vi je zatim sami šaljete. Poruku koristimo da bismo odgovorili na
                vaš upit i dogovorili dostupnost i cenu prevoza.
              </p>
            </section>
            <section>
              <h2>WhatsApp</h2>
              <p>
                Nakon što poruku pošaljete, komunikacija se odvija putem WhatsApp-a i podleže uslovima i politici
                privatnosti te usluge.
              </p>
            </section>
            <section>
              <h2>Vaša prava</h2>
              <p>
                Možete nas u bilo kom trenutku zamoliti da izbrišemo prepisku i podatke koje ste nam poslali putem
                WhatsApp-a.
              </p>
            </section>
            <section>
              <h2>Kontakt</h2>
              <p>
                Za pitanja o privatnosti pišite nam putem WhatsApp-a
                {contact.email ? (
                  <>
                    {" "}
                    ili na <a className="text-brand hover:text-brand-hover" href={`mailto:${contact.email}`}>{contact.email}</a>
                  </>
                ) : null}
                .
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
