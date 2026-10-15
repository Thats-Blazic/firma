"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Minus,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import { BOOKING_SECTION_ID, useBooking } from "@/components/booking-context";
import { WhatsAppIcon } from "@/components/icons";
import { Eyebrow, Reveal } from "@/components/reveal";
import { telHref } from "@/components/contact-section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DateField } from "@/components/ui/date-field";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destinations, isWhatsAppConfigured, locationOptions, siteConfig } from "@/config/site";
import {
  bookingSchema,
  MAX_PASSENGERS,
  MIN_PASSENGERS,
  type BookingFormValues,
} from "@/lib/booking";
import { startOfDay, startOfToday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { buildBookingMessage, buildWhatsAppUrl, openWhatsApp } from "@/lib/whatsapp";

const { contact } = siteConfig;

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          key="error"
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="mt-2 flex items-start gap-1.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

const sideImage = destinations.find((d) => d.slug === "manastir-ostrog") ?? destinations[0];

export function BookingForm() {
  const { prefill } = useBooking();
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const today = useMemo(() => startOfToday(), []);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    mode: "onTouched",
    defaultValues: {
      origin: "",
      destination: "",
      roundTrip: true,
      passengers: 2,
      vehicle: "car",
      name: "",
      phone: "",
      notes: "",
    },
  });

  const roundTrip = useWatch({ control, name: "roundTrip" });
  const departureDate = useWatch({ control, name: "departureDate" });
  const notesLength = (useWatch({ control, name: "notes" }) ?? "").length;

  // A destination card elsewhere on the page was clicked → prefill the field.
  useEffect(() => {
    if (!prefill) return;
    setValue("destination", prefill.destination, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [prefill, setValue]);

  const returnMin = departureDate ? startOfDay(departureDate) : today;

  async function onSubmit(values: BookingFormValues) {
    const url = buildWhatsAppUrl(buildBookingMessage(values));
    openWhatsApp(url);
    setSentUrl(url);
  }

  return (
    <section
      id={BOOKING_SECTION_ID}
      aria-labelledby="booking-title"
      className="section-y relative scroll-mt-20 overflow-hidden bg-bg"
    >
      <div className="container-page relative grid gap-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 xl:gap-24">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <Eyebrow index="01" className="mb-6">
              Rezervacija
            </Eyebrow>
            <h2
              id="booking-title"
              className="text-[2.125rem] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-5xl lg:text-[3.25rem]"
            >
              Rezervišite svoje putovanje
            </h2>
            <p className="mt-6 max-w-md text-base leading-[1.7] text-muted sm:text-[1.0625rem]">
              Popunite podatke i pošaljite upit direktno putem WhatsApp-a.
            </p>

            <ul className="mt-10 hidden border-t border-hair lg:block">
              {["Udoban putnički automobil", "Jednosmerna ili povratna vožnja", "Odgovor direktno putem WhatsApp-a"].map(
                (line, i) => (
                  <li key={line} className="flex items-center gap-5 border-b border-hair py-4 text-sm text-fg/85">
                    <span className="text-[0.7rem] font-semibold tabular-nums tracking-[0.2em] text-brand">0{i + 1}</span>
                    {line}
                  </li>
                ),
              )}
            </ul>

            <figure className="relative mt-10 hidden aspect-[16/10] overflow-hidden rounded-xl border border-line lg:block">
              <Image
                src={sideImage.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 36vw, 0px"
                className="object-cover object-[50%_35%] brightness-[0.8] saturate-[0.85]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <figcaption className="absolute bottom-4 left-5 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-fg/80">
                {sideImage.name}
              </figcaption>
            </figure>
          </Reveal>
        </aside>

        <Reveal delay={0.1}>
          <div className="surface-raised rounded-2xl p-5 sm:p-10">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-7 md:grid-cols-2">
              {/* Polazna lokacija */}
              <div>
                <Label htmlFor="origin" required>
                  Polazna lokacija
                </Label>
                <Controller
                  name="origin"
                  control={control}
                  render={({ field }) => (
                    <Combobox
                      id="origin"
                      name={field.name}
                      inputRef={field.ref}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={locationOptions}
                      placeholder="Unesite mesto polaska"
                      invalid={!!errors.origin}
                      describedBy={errors.origin ? "origin-error" : undefined}
                    />
                  )}
                />
                <FieldError id="origin-error" message={errors.origin?.message} />
              </div>

              {/* Destinacija */}
              <div>
                <Label htmlFor="destination" required>
                  Destinacija
                </Label>
                <div className="relative">
                  <Controller
                    name="destination"
                    control={control}
                    render={({ field }) => (
                      <Combobox
                        id="destination"
                        name={field.name}
                        inputRef={field.ref}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        options={locationOptions}
                        placeholder="Izaberite ili unesite"
                        invalid={!!errors.destination}
                        describedBy={errors.destination ? "destination-error" : undefined}
                      />
                    )}
                  />
                  {prefill ? (
                    <motion.span
                      key={prefill.nonce}
                      aria-hidden="true"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 1.8, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-brand shadow-[0_0_30px_rgb(240_120_50/0.45)]"
                    />
                  ) : null}
                </div>
                <FieldError id="destination-error" message={errors.destination?.message} />
              </div>

              {/* Povratna vožnja */}
              <div className="md:col-span-2">
                <label
                  htmlFor="roundTrip"
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-field px-4 py-3.5 transition-[border-color,background-color] duration-200 hover:border-white/25",
                    "has-[:checked]:border-brand/50 has-[:checked]:bg-brand/[0.05] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/15",
                  )}
                >
                  <input
                    id="roundTrip"
                    type="checkbox"
                    className="peer sr-only"
                    {...register("roundTrip", {
                      onChange: (e) => {
                        if (!e.target.checked) {
                          setValue("returnDate", undefined);
                          clearErrors("returnDate");
                        }
                      },
                    })}
                  />
                  <span className="text-sm font-medium sm:text-[0.95rem]">Potrebna mi je povratna vožnja</span>
                  <span
                    aria-hidden="true"
                    className="relative h-6 w-11 shrink-0 rounded-full bg-[#3a3a3a] transition-colors duration-300 after:absolute after:left-[3px] after:top-[3px] after:size-[18px] after:rounded-full after:bg-fg after:transition-transform after:duration-300 peer-checked:bg-brand peer-checked:after:translate-x-5 peer-checked:after:bg-[#0b0b0b]"
                  />
                </label>
              </div>

              {/* Datum polaska */}
              <div className={cn(!roundTrip && "md:col-span-2")}>
                <Label htmlFor="departureDate" required>
                  Datum polaska
                </Label>
                <Controller
                  name="departureDate"
                  control={control}
                  render={({ field }) => (
                    <DateField
                      id="departureDate"
                      buttonRef={field.ref}
                      value={field.value}
                      minDate={today}
                      placeholder="Izaberite datum"
                      invalid={!!errors.departureDate}
                      describedBy={errors.departureDate ? "departureDate-error" : undefined}
                      onBlur={field.onBlur}
                      onChange={(date) => {
                        field.onChange(date);
                        const currentReturn = getValues("returnDate");
                        if (date && currentReturn && startOfDay(currentReturn) < startOfDay(date)) {
                          setValue("returnDate", undefined);
                        }
                      }}
                    />
                  )}
                />
                <FieldError id="departureDate-error" message={errors.departureDate?.message} />
              </div>

              {/* Datum povratka */}
              <AnimatePresence initial={false}>
                {roundTrip ? (
                  <motion.div
                    key="return-date"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Label htmlFor="returnDate" required>
                      Datum povratka
                    </Label>
                    <Controller
                      name="returnDate"
                      control={control}
                      render={({ field }) => (
                        <DateField
                          id="returnDate"
                          buttonRef={field.ref}
                          value={field.value}
                          minDate={returnMin}
                          placeholder="Izaberite datum povratka"
                          invalid={!!errors.returnDate}
                          describedBy={errors.returnDate ? "returnDate-error" : undefined}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <FieldError id="returnDate-error" message={errors.returnDate?.message} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Broj putnika */}
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-field p-4 sm:px-5">
                  <div>
                    <span id="passengers-label" className="mb-0.5 block text-sm font-semibold">
                      Broj putnika
                      <span className="ml-0.5 text-brand" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <p className="text-sm text-muted">Najmanje {MIN_PASSENGERS}, najviše {MAX_PASSENGERS}.</p>
                  </div>

                  <Controller
                    name="passengers"
                    control={control}
                    render={({ field }) => (
                      <div
                        role="group"
                        aria-labelledby="passengers-label"
                        className="flex items-center gap-3"
                      >
                        <button
                          type="button"
                          aria-label="Smanji broj putnika"
                          disabled={field.value <= MIN_PASSENGERS}
                          onClick={() => field.onChange(Math.max(MIN_PASSENGERS, field.value - 1))}
                          className="grid size-11 place-items-center rounded-lg border border-line bg-card text-fg transition-all hover:border-white/40 hover:bg-white/[0.06] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-card"
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </button>

                        <div
                          aria-live="polite"
                          aria-atomic="true"
                          className="flex min-w-20 items-center justify-center gap-2.5 px-2 text-fg"
                        >
                          <Users className="size-4 text-muted" aria-hidden="true" />
                          <motion.span
                            key={field.value}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                            className="text-2xl font-semibold tabular-nums"
                          >
                            {field.value}
                          </motion.span>
                          <span className="sr-only">putnika</span>
                        </div>

                        <button
                          type="button"
                          aria-label="Povećaj broj putnika"
                          disabled={field.value >= MAX_PASSENGERS}
                          onClick={() => field.onChange(Math.min(MAX_PASSENGERS, field.value + 1))}
                          className="grid size-11 place-items-center rounded-lg border border-line bg-card text-fg transition-all hover:border-white/40 hover:bg-white/[0.06] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-card"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  />
                </div>
                <FieldError id="passengers-error" message={errors.passengers?.message} />
              </div>

              {/* Ime i prezime */}
              <div>
                <Label htmlFor="name" required>
                  Ime i prezime
                </Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Vaše ime i prezime"
                  invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  {...register("name")}
                />
                <FieldError id="name-error" message={errors.name?.message} />
              </div>

              {/* Broj telefona */}
              <div>
                <Label htmlFor="phone" required>
                  Broj telefona
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+381 / +382 ..."
                  invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  {...register("phone")}
                />
                <FieldError id="phone-error" message={errors.phone?.message} />
              </div>

              {/* Dodatne napomene */}
              <div className="md:col-span-2">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <Label htmlFor="notes" className="mb-0">
                    Dodatne napomene <span className="font-normal text-muted">(opciono)</span>
                  </Label>
                  <span className="text-xs tabular-nums text-muted" aria-hidden="true">
                    {notesLength}/600
                  </span>
                </div>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Prtljag, dečije sedište, tačna adresa preuzimanja, vreme polaska..."
                  invalid={!!errors.notes}
                  aria-describedby={errors.notes ? "notes-error" : undefined}
                  {...register("notes")}
                />
                <FieldError id="notes-error" message={errors.notes?.message} />
              </div>

              {/* Submit */}
              <div className="border-t border-hair pt-8 md:col-span-2">
                <Button type="submit" variant="whatsapp" size="lg" className="w-full" disabled={isSubmitting}>
                  <WhatsAppIcon className="size-5" />
                  Pošalji upit putem WhatsApp-a
                  <Send
                    className="size-4 opacity-70 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Button>

                {contact.phone ? (
                  <>
                    <div className="my-5 flex items-center gap-4" aria-hidden="true">
                      <span className="h-px flex-1 bg-hair" />
                      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted">ili</span>
                      <span className="h-px flex-1 bg-hair" />
                    </div>
                    <ButtonLink
                      href={telHref(contact.phone)}
                      variant="outline"
                      size="lg"
                      className="w-full"
                      aria-label={`Pozovite za zakazivanje: ${contact.phone}`}
                    >
                      <Phone className="size-5 text-brand" aria-hidden="true" />
                      Pozovite za zakazivanje
                      <span className="hidden font-normal text-muted sm:inline">· {contact.phone}</span>
                    </ButtonLink>
                  </>
                ) : null}

                <p className="mt-5 flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-muted">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg/50" strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    Ovo je upit, a ne potvrda rezervacije. Dostupnost i cenu potvrđujemo direktno putem WhatsApp-a.
                  </span>
                </p>

                {process.env.NODE_ENV !== "production" && !isWhatsAppConfigured ? (
                  <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
                    Razvojno upozorenje: WhatsApp broj nije podešen. Unesite ga u <code>src/config/site.ts</code> ili
                    u <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> (.env.local).
                  </p>
                ) : null}

                <AnimatePresence>
                  {sentUrl ? (
                    <motion.div
                      key="sent"
                      role="status"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-5 rounded-2xl border border-whatsapp/40 bg-whatsapp/10 p-4 text-sm"
                    >
                      <p className="flex items-start gap-2 font-semibold text-whatsapp">
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        Upit je pripremljen u WhatsApp-u.
                      </p>
                      <p className="mt-1.5 text-muted">
                        Pošaljite poruku u WhatsApp-u kako bismo dobili vaš upit i javili se sa dostupnošću i cenom. Ako
                        se aplikacija nije otvorila,{" "}
                        <a
                          href={sentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-whatsapp underline underline-offset-4"
                        >
                          otvorite WhatsApp ručno
                        </a>
                        .
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
