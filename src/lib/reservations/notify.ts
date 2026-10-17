import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getSettings } from "@/lib/reservations/public-data";
import { formatMoney } from "@/lib/reservations/pricing";
import { formatDateTimeSr } from "@/lib/reservations/time";
import { STATUS_LABELS, type BookingRow, type Settings } from "@/lib/reservations/types";

/**
 * Notifications run AFTER the booking transaction has committed (see the route handler
 * and admin actions: they call this inside `after()`), so a failing provider can never
 * create, duplicate or roll back a reservation. Every attempt is written to the
 * `notifications` table — "skipped" and "failed" are recorded honestly.
 */

export type NotifyEvent = "created" | "confirmed" | "cancelled";

type Outcome = { status: "sent" | "failed" | "skipped"; detail: string };

const SUBJECTS: Record<NotifyEvent, string> = {
  created: "Primili smo vašu rezervaciju",
  confirmed: "Vaša rezervacija je potvrđena",
  cancelled: "Vaša rezervacija je otkazana",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function routeLine(b: BookingRow) {
  return `${b.origin_name} → ${b.destination_name}`;
}

export function adminMessageText(b: BookingRow, settings: Settings, event: NotifyEvent): string {
  const tz = settings.timezone;
  const head =
    event === "created" ? "Nova rezervacija" : event === "confirmed" ? "Rezervacija potvrđena" : "Rezervacija otkazana";
  const lines = [
    `${head} ${b.reference}`,
    `Relacija: ${routeLine(b)}`,
    `Polazak: ${formatDateTimeSr(b.departure_at, tz)}`,
    ...(b.return_departure_at ? [`Povratak: ${formatDateTimeSr(b.return_departure_at, tz)}`] : []),
    `Putnika: ${b.passengers}`,
    `Cena: ${formatMoney(Number(b.total_price), b.currency)}`,
    `Status: ${STATUS_LABELS[b.status]}`,
    `Klijent: ${b.customer_name}, ${b.customer_phone}`,
  ];
  return lines.join("\n");
}

async function sendWhatsAppToAdmin(b: BookingRow, settings: Settings, event: NotifyEvent): Promise<Outcome> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = settings.admin_phone.replace(/\D/g, "");
  if (!settings.notify_admin_whatsapp) return { status: "skipped", detail: "Isključeno u podešavanjima." };
  if (!token || !phoneId) {
    return { status: "skipped", detail: "WhatsApp Cloud API nije podešen (WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." };
  }
  if (!to) return { status: "skipped", detail: "Broj telefona administratora nije unet u podešavanjima." };

  const template = process.env.WHATSAPP_ADMIN_TEMPLATE;
  const text = adminMessageText(b, settings, event);
  const body = template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "sr" },
          // Template body is expected to have a single {{1}} variable that receives the summary.
          components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\n/g, " | ").slice(0, 900) }] }],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { status: "failed", detail: `HTTP ${res.status}: ${detail}` };
    }
    return { status: "sent", detail: template ? `Šablon ${template}` : "Tekstualna poruka" };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "Nepoznata greška" };
  }
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<Outcome> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { status: "skipped", detail: "E-pošta nije podešena (RESEND_API_KEY / EMAIL_FROM)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "failed", detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { status: "sent", detail: to };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "Nepoznata greška" };
  }
}

function customerEmailContent(b: BookingRow, settings: Settings, event: NotifyEvent) {
  const tz = settings.timezone;
  const intro =
    event === "created"
      ? b.status === "confirmed"
        ? "Vaša rezervacija je primljena i potvrđena."
        : "Primili smo vašu rezervaciju. Potvrdićemo je u najkraćem roku — do tada je status „na čekanju“."
      : event === "confirmed"
        ? "Vaša rezervacija je potvrđena. Radujemo se vožnji!"
        : "Vaša rezervacija je otkazana." + (b.cancel_reason ? ` Razlog: ${b.cancel_reason}` : "");

  const rows: [string, string][] = [
    ["Broj rezervacije", b.reference],
    ["Relacija", routeLine(b)],
    ["Polazak", formatDateTimeSr(b.departure_at, tz)],
    ...(b.return_departure_at ? ([["Povratak", formatDateTimeSr(b.return_departure_at, tz)]] as [string, string][]) : []),
    ["Putnika", String(b.passengers)],
    ["Ukupna cena", formatMoney(Number(b.total_price), b.currency)],
    ["Status", STATUS_LABELS[b.status]],
  ];
  const contact = settings.company_phone ? `Pitanja? ${settings.company_phone}` : "";
  const policy = settings.cancellation_policy ? `\n\nUslovi otkazivanja:\n${settings.cancellation_policy}` : "";
  const text = `Poštovani/a ${b.customer_name},\n\n${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}${policy}\n\n${contact}\n${settings.company_name}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 12px">${escapeHtml(settings.company_name)}</h2>
<p>Poštovani/a ${escapeHtml(b.customer_name)},</p><p>${escapeHtml(intro)}</p>
<table style="border-collapse:collapse;width:100%">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#666">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right"><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join("")}</table>
${settings.cancellation_policy ? `<p style="color:#666;font-size:13px"><strong>Uslovi otkazivanja:</strong><br>${escapeHtml(settings.cancellation_policy).replace(/\n/g, "<br>")}</p>` : ""}
<p style="color:#666;font-size:13px">${escapeHtml(contact)}</p></div>`;
  return { subject: `${SUBJECTS[event]} ${b.reference}`, text, html };
}

export async function notifyBooking(
  bookingId: string,
  event: NotifyEvent,
  opts: { customerOnly?: boolean } = {},
): Promise<void> {
  try {
    const db = createServiceClient();
    const settings = await getSettings();
    const { data } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!data) return;
    const booking = { ...data, total_price: Number(data.total_price) } as BookingRow;

    const log = async (channel: "whatsapp" | "email", recipient: "admin" | "customer", outcome: Outcome) => {
      await db.from("notifications").insert({
        booking_id: booking.id,
        channel,
        recipient,
        event,
        status: outcome.status,
        detail: outcome.detail.slice(0, 500),
      });
    };

    const jobs: Promise<void>[] = [];

    // Administrator: new bookings (and cancellations) by WhatsApp Cloud API and e-mail.
    if (!opts.customerOnly && (event === "created" || event === "cancelled")) {
      jobs.push(
        sendWhatsAppToAdmin(booking, settings, event).then((o) => log("whatsapp", "admin", o)),
        (async () => {
          if (!settings.notify_admin_email) return log("email", "admin", { status: "skipped", detail: "Isključeno u podešavanjima." });
          if (!settings.admin_email) return log("email", "admin", { status: "skipped", detail: "E-adresa administratora nije uneta." });
          const text = adminMessageText(booking, settings, event);
          const html = `<pre style="font-family:inherit;font-size:14px">${escapeHtml(text)}</pre>`;
          return log("email", "admin", await sendEmail(settings.admin_email, `${event === "created" ? "Nova" : "Otkazana"} rezervacija ${booking.reference}`, text, html));
        })(),
      );
    }

    // Customer: e-mail only, and only if they gave an address and the feature is enabled.
    if (booking.customer_email) {
      jobs.push(
        (async () => {
          if (!settings.notify_customer_email) return log("email", "customer", { status: "skipped", detail: "Isključeno u podešavanjima." });
          const content = customerEmailContent(booking, settings, event);
          return log("email", "customer", await sendEmail(booking.customer_email!, content.subject, content.text, content.html));
        })(),
      );
    }

    await Promise.allSettled(jobs);
  } catch (error) {
    console.error("[notify] failed", error);
  }
}
