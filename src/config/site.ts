/**
 * ============================================================================
 *  ADRIATIC TRANS — central site configuration
 * ============================================================================
 *  Everything a business owner needs to edit lives in this file:
 *    • WhatsApp number            → `whatsapp.number`   (REQUIRED before launch)
 *    • Phone / e-mail / hours     → `contact`           (hidden on the site until filled in)
 *    • Social links               → `social`            (hidden on the site until filled in)
 *    • Google Business / reviews  → `google`
 *    • Customer reviews           → `reviews`
 *    • Destination cards + list   → `destinations`, `extraLocations`
 *
 *  >>> WHERE TO ENTER THE REAL WHATSAPP NUMBER <<<
 *  Either set it below in `whatsapp.number`, or (recommended) create a
 *  `.env.local` file with:   NEXT_PUBLIC_WHATSAPP_NUMBER=38267123456
 *  Use international format, digits only: no "+", spaces, dashes or brackets.
 *  Until a real number is set, the booking form still builds the message,
 *  but WhatsApp will report that the number is invalid.
 * ============================================================================
 */

/** Obviously fake placeholder so nobody mistakes it for a real number. */
const WHATSAPP_PLACEHOLDER = "000000000000";

const envWhatsApp = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export type Destination = {
  slug: string;
  /** Exact value written into the booking form's "Destinacija" field. */
  name: string;
  country: "Srbija" | "Crna Gora";
  description: string;
  image: string;
  imageAlt: string;
  credit: { author: string; license: string; source: string };
};

export const siteConfig = {
  name: "Adriatic Trans",
  shortName: "Adriatic Trans",
  title: "Adriatic Trans | Prevoz putnika i transferi",
  description:
    "Udoban i pouzdan prevoz putnika putničkim automobilom do Zlatibora, Ostroga, Budve, Kotora, Tivta, Podgorice i drugih destinacija u Srbiji i Crnoj Gori. Pošaljite upit putem WhatsApp-a.",
  /** Canonical site URL. Override with NEXT_PUBLIC_SITE_URL in production. */
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  locale: "sr_RS",
  language: "sr-Latn",

  whatsapp: {
    /** International format, digits only. See the note at the top of this file. */
    number: envWhatsApp || "381612378859",
    /** Opening line used by the generic "contact us" buttons (not the booking form). */
    greeting: "Poštovani Adriatic Trans, želeo/la bih da se informišem o prevozu.",
  },

  contact: {
    /** Human readable phone, e.g. "+382 67 123 456". Leave "" to hide. */
    phone: "+381 61 2378859",
    /** e.g. "info@vasdomen.com". Leave "" to hide. */
    email: "",
    /** e.g. "Svakog dana, 08:00 – 22:00". Leave "" to hide. */
    hours: "",
    /** Only fill in if you have a genuine, public business location. */
    address: "",
    /** Google Maps *embed* URL (Share → Embed a map → copy the src). Leave "" to hide the map. */
    mapEmbedUrl: "",
    serviceArea:
      "Srbija, Crna Gora i druge dostupne regionalne destinacije — dogovor oko pravca je uvek moguć.",
  },

  /** Full URLs. Empty strings are hidden in the footer. */
  social: {
    instagram: "",
    facebook: "",
  },

  google: {
    /** Direct link to your Google review form / Business Profile reviews. */
    reviewUrl: "",
    /** Used only when `reviewUrl` is empty. */
    fallbackSearchUrl: "https://www.google.com/search?q=Adriatic+Trans+recenzije",
    /**
     * Set ONLY with genuine data from your Google Business Profile, e.g.
     * `{ rating: 4.9, count: 27 }`. While `null`, no rating is shown.
     */
    aggregate: null as { rating: number; count: number } | null,
  },

  /** Footer: legal page. */
  privacyPath: "/politika-privatnosti",
};

export type NavItem = { label: string; href: string; id: string };

const baseNavItems: NavItem[] = [
  { label: "Početna", href: "#pocetna", id: "pocetna" },
  { label: "Destinacije", href: "#destinacije", id: "destinacije" },
  { label: "Usluge", href: "#usluge", id: "usluge" },
  { label: "Recenzije", href: "#recenzije", id: "recenzije" },
  { label: "Kontakt", href: "#kontakt", id: "kontakt" },
];

/** Destinations shown as photo cards. Photos live in /public/images/destinations. */
export const destinations: Destination[] = [
  {
    slug: "zlatibor",
    name: "Zlatibor",
    country: "Srbija",
    description: "Planinski predeli zapadne Srbije, borove šume i čist vazduh — savršen predah od gužve.",
    image: "/images/destinations/zlatibor.jpg",
    imageAlt: "Brdoviti predeli Zlatibora sa jezerom u dolini",
    credit: { author: "Luka Jankovic", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Zlatibor_chilling_in_the_sun.jpg" },
  },
  {
    slug: "manastir-ostrog",
    name: "Manastir Ostrog",
    country: "Crna Gora",
    description: "Čuveni manastir ukopan u gotovo vertikalnu stenu, jedno od najposećenijih svetilišta regiona.",
    image: "/images/destinations/ostrog.jpg",
    imageAlt: "Manastir Ostrog u steni iznad doline",
    credit: { author: "Diego Delso", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Monasterio_de_Ostrog,_Montenegro,_2014-04-14,_DD_14.JPG" },
  },
  {
    slug: "budva",
    name: "Budva",
    country: "Crna Gora",
    description: "Stari grad na obali, peščane plaže i živahna jadranska atmosfera tokom cele sezone.",
    image: "/images/destinations/budva.jpg",
    imageAlt: "Pogled na stari grad Budvu i jadransku obalu",
    credit: { author: "Jaakko Luttinen", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:View_of_Budva_Old_Town.jpg" },
  },
  {
    slug: "kotor",
    name: "Kotor",
    country: "Crna Gora",
    description: "Srednjovekovni grad u dubokom Bokokotorskom zalivu, okružen strmim planinama.",
    image: "/images/destinations/kotor.jpg",
    imageAlt: "Pogled na Kotor i Bokokotorski zaliv okružen planinama",
    credit: { author: "kallerna", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Bay_of_Kotor_3.jpg" },
  },
  {
    slug: "tivat",
    name: "Tivat",
    country: "Crna Gora",
    description: "Elegantna marina, uređena šetališta i dobra veza sa tivatskim aerodromom.",
    image: "/images/destinations/tivat.jpg",
    imageAlt: "Zalazak sunca iznad marine Porto Montenegro u Tivtu",
    credit: { author: "Корнет Кларнет", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Tivat,_Montenegro,_Boko_Kotor_Bay_and_Porto_Montenegro_at_sunset.jpg" },
  },
  {
    slug: "podgorica",
    name: "Podgorica",
    country: "Crna Gora",
    description: "Glavni grad Crne Gore i važna tačka za povezivanje severa i juga zemlje.",
    image: "/images/destinations/podgorica.jpg",
    imageAlt: "Milenijum most u Podgorici iznad reke Morače",
    credit: { author: "Desemeus", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Millenium_Bridge_2023.jpg" },
  },
  {
    slug: "herceg-novi",
    name: "Herceg Novi",
    country: "Crna Gora",
    description: "Zeleni grad na ulazu u Bokokotorski zaliv, poznat po šetalištima i stepeništima.",
    image: "/images/destinations/herceg-novi.jpg",
    imageAlt: "Pogled na Herceg Novi, marinu i okolna brda",
    credit: { author: "Marcin Konsek", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Widok_na_miasto_z_portu_w_Herceg_Novi_01.jpg" },
  },
  {
    slug: "zabljak",
    name: "Žabljak",
    country: "Crna Gora",
    description: "Kapija nacionalnog parka Durmitor i Crnog jezera — za ljubitelje planina i prirode.",
    image: "/images/destinations/zabljak.jpg",
    imageAlt: "Crno jezero kod Žabljaka okruženo četinarskom šumom",
    credit: { author: "Mathieu Mars", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Crno_jezero_2020.jpg" },
  },
];

/**
 * Extra suggestions for the booking form's searchable fields. Visitors can
 * always type any other place too.
 */
export const extraLocations: string[] = [
  "Beograd",
  "Novi Sad",
  "Niš",
  "Kragujevac",
  "Čačak",
  "Užice",
  "Sarajevo",
  "Dubrovnik",
  "Bar",
  "Ulcinj",
  "Cetinje",
  "Nikšić",
  "Kolašin",
  "Petrovac",
  "Sveti Stefan",
  "Perast",
  "Aerodrom Nikola Tesla (Beograd)",
  "Aerodrom Podgorica",
  "Aerodrom Tivat",
];

/** Sorted-for-UI list used by the booking form comboboxes. */
export const locationOptions: string[] = Array.from(
  new Set([...destinations.map((d) => d.name), ...extraLocations]),
);

/**
 * Passenger reviews shown in the Reviews section. While `items` is empty the
 * whole section (and its menu link) is hidden. `date` is shown under the name
 * (here: the passenger's city). Set `isDemo` to true to label cards as examples.
 */
export const reviewsConfig = {
  /** While true, every card is visibly labeled as demo content. */
  isDemo: false,
  items: [
    {
      id: "marko-petrovic",
      name: "Marko Petrović",
      initials: "MP",
      date: "Beograd, Srbija",
      rating: 5,
      text: "Sve pohvale za Adriatic Trans! Vožnja je bila odlična, auto čist i udoban, a vozač maksimalno profesionalan i ljubazan. Stigli smo na vreme bez ikakvih problema. Definitivno preporuka!",
    },
    {
      id: "nikola-jovanovic",
      name: "Nikola Jovanović",
      initials: "NJ",
      date: "Podgorica, Crna Gora",
      rating: 5,
      text: "Putovao sam do Ostroga i iskustvo je bilo stvarno odlično. Vozač je iskusan, smiren i veoma korektan. Sve je bilo organizovano kako treba, bez čekanja i nerviranja. Svaka čast!",
    },
    {
      id: "milica-nikolic",
      name: "Milica Nikolić",
      initials: "MN",
      date: "Novi Sad, Srbija",
      rating: 5,
      text: "Prevoz do Zlatibora je prošao bez ikakvih problema. Auto je bio uredan, vožnja prijatna, a vozač ljubazan i pažljiv tokom celog puta. Baš ono što očekujete od profesionalnog prevoza.",
    },
    {
      id: "stefan-kovacevic",
      name: "Stefan Kovačević",
      initials: "SK",
      date: "Banja Luka, BiH",
      rating: 5,
      text: "Odlična usluga od dogovora do dolaska na destinaciju. Sve je bilo po dogovoru, vozač profesionalan, komunikacija odlična, a putovanje veoma udobno. Ponovo bih koristio njihove usluge.",
    },
    {
      id: "ana-markovic",
      name: "Ana Marković",
      initials: "AM",
      date: "Nikšić, Crna Gora",
      rating: 5,
      text: "Sve preporuke za Adriatic Trans! Vozač je bio tačan, kulturan i veoma prijatan. Vožnja je bila sigurna i opuštena, a dogovor jednostavan i brz. Usluga na nivou!",
    },
  ] as { id: string; name: string; initials: string; date: string; rating: number; text: string }[],
};

export const hasReviews = reviewsConfig.items.length > 0;

/** Menu items; the Reviews link only appears once there are real reviews. */
export const navItems: NavItem[] = baseNavItems.filter((item) => item.id !== "recenzije" || hasReviews);

export const heroImage = {
  src: "/images/hero-cinematic.jpg",
  alt: "Crni putnički automobil na planinskom putu sa snežnim vrhovima u pozadini",
  credit: { author: "Nikola Tasic", license: "Unsplash License", source: "https://unsplash.com/photos/black-car-driving-on-a-mountain-road-5-fhlD2Gc2w" },
};

export const isWhatsAppConfigured = siteConfig.whatsapp.number !== WHATSAPP_PLACEHOLDER;
