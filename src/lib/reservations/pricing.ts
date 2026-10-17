import type { Fee, PricingMode, QuoteLine, RouteRow, TripRow } from "@/lib/reservations/types";

/**
 * Pure price calculation. It is used by the server both to show a quote and to price the
 * final booking — the browser never supplies an amount that is trusted.
 */

export type Quote = {
  currency: string;
  lines: QuoteLine[];
  total: number;
  unitPrice: number;
  returnUnitPrice: number | null;
  pricingMode: PricingMode;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function effectiveUnitPrice(route: Pick<RouteRow, "base_price">, trip: Pick<TripRow, "price_override">): number {
  return Number(trip.price_override ?? route.base_price);
}

function legAmount(mode: PricingMode, unit: number, passengers: number) {
  return round2(mode === "per_person" ? unit * passengers : unit);
}

function legDetail(mode: PricingMode, unit: number, passengers: number, currency: string) {
  return mode === "per_person"
    ? `${passengers} × ${formatMoney(unit, currency)}`
    : "Privatno vozilo, fiksna cena";
}

export function normalizeFees(raw: unknown): Fee[] {
  if (!Array.isArray(raw)) return [];
  const fees: Fee[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { label, amount, per } = item as Record<string, unknown>;
    const value = Number(amount);
    if (typeof label !== "string" || !label.trim() || !Number.isFinite(value) || value < 0) continue;
    fees.push({ label: label.trim().slice(0, 60), amount: value, per: per === "person" ? "person" : "booking" });
  }
  return fees;
}

export function computeQuote(input: {
  currency: string;
  route: RouteRow;
  trip: TripRow;
  /** Present for round trips: the return leg's trip and its (reverse) route. */
  returnTrip?: TripRow | null;
  returnRoute?: RouteRow | null;
  passengers: number;
}): Quote {
  const { currency, route, trip, returnTrip, returnRoute, passengers } = input;
  const lines: QuoteLine[] = [];

  const unit = effectiveUnitPrice(route, trip);
  const outbound = legAmount(route.pricing_mode, unit, passengers);
  lines.push({
    kind: "outbound",
    label: "Polazak",
    detail: legDetail(route.pricing_mode, unit, passengers, currency),
    amount: outbound,
  });

  let total = outbound;
  let returnUnit: number | null = null;

  if (returnTrip && returnRoute) {
    // Priority: a custom price on the return trip, then the return price set on the outbound
    // route, then the reverse route's own price (each uses the pricing mode it was defined in).
    let mode: PricingMode = returnRoute.pricing_mode;
    if (returnTrip.price_override !== null && returnTrip.price_override !== undefined) {
      returnUnit = Number(returnTrip.price_override);
    } else if (route.return_price !== null && route.return_price !== undefined) {
      returnUnit = Number(route.return_price);
      mode = route.pricing_mode;
    } else {
      returnUnit = Number(returnRoute.base_price);
    }
    const back = legAmount(mode, returnUnit, passengers);
    lines.push({ kind: "return", label: "Povratak", detail: legDetail(mode, returnUnit, passengers, currency), amount: back });
    total += back;
  }

  for (const fee of normalizeFees(route.fees)) {
    const amount = round2(fee.per === "person" ? fee.amount * passengers : fee.amount);
    if (amount <= 0) continue;
    lines.push({
      kind: "fee",
      label: fee.label,
      detail: fee.per === "person" ? `${passengers} × ${formatMoney(fee.amount, currency)}` : undefined,
      amount,
    });
    total += amount;
  }

  return {
    currency,
    lines,
    total: round2(total),
    unitPrice: unit,
    returnUnitPrice: returnUnit,
    pricingMode: route.pricing_mode,
  };
}

export function formatMoney(amount: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("sr-Latn-RS", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
