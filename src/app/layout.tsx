import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { Providers } from "@/components/providers";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: "%s | Adrirora Travel",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "prevoz putnika",
    "transfer",
    "Adrirora Travel",
    "prevoz Crna Gora",
    "prevoz Srbija",
    "aerodromski transfer",
    "Zlatibor",
    "Ostrog",
    "Budva",
    "Kotor",
    "Tivat",
    "Podgorica",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/og-image.jpg",
        width: 1024,
        height: 537,
        alt: "Adrirora Travel — prevoz putnika i transferi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/og-image.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  logo: `${siteConfig.url}/logo.png`,
  description: siteConfig.description,
  areaServed: ["Srbija", "Crna Gora"],
  knowsAbout: ["Prevoz putnika", "Transferi", "Aerodromski transferi"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr-Latn" className={manrope.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
