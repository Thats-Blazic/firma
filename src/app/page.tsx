import { AvailableTrips } from "@/components/available-trips";
import { BookingForm } from "@/components/booking-form";
import { hasReviews } from "@/config/site";
import { ContactSection } from "@/components/contact-section";
import { DestinationsSection } from "@/components/destinations-section";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/hero-section";
import { HowItWorks } from "@/components/how-it-works";
import { Navbar } from "@/components/navbar";
import { ReviewsSection } from "@/components/reviews-section";
import { ServicesSection } from "@/components/services-section";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { WhyChooseUs } from "@/components/why-choose-us";
import { isBookingSystemConfigured } from "@/lib/supabase/env";

export default function HomePage() {
  // With the booking system set up, the live "Trenutni polasci" list sits right above Usluge and
  // the WhatsApp form below it becomes a secondary 'special request' form.
  const online = isBookingSystemConfigured();

  return (
    <>
      <a
        href="#glavni-sadrzaj"
        className="sr-only z-[100] rounded-full bg-brand px-5 py-3 font-bold text-[#0b0b0b] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Preskoči na sadržaj
      </a>
      <Navbar />
      <main id="glavni-sadrzaj">
        <HeroSection />
        {online ? (
          <>
            <DestinationsSection sectionIndex="01" />
            <AvailableTrips />
            <BookingForm variant="inquiry" />
          </>
        ) : (
          <>
            <BookingForm variant="primary" />
            <DestinationsSection />
          </>
        )}
        <ServicesSection />
        <WhyChooseUs />
        {hasReviews ? <ReviewsSection /> : null}
        <HowItWorks />
        <ContactSection />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
