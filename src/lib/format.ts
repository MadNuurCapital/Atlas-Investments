/**
 * Presentation formatting for Singapore.
 *
 * Two rules are enforced here rather than left to each screen:
 *
 *   1. Missing data reads "Not available", never "0" or "0%". A zero is a
 *      real answer; showing one where there is no data is a lie an advisor
 *      could repeat to a client.
 *   2. Every rate in the database is a decimal fraction (0.05 = 5%). The
 *      conversion to a percentage happens here and nowhere else.
 */

export const SG_LOCALE = "en-SG";
export const SG_TIMEZONE = "Asia/Singapore";
export const NOT_AVAILABLE = "Not available";

type Maybe = number | null | undefined;

function isMissing(value: Maybe): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

/**
 * Money, always SGD in V1. `S$12,345.67`
 *
 * The "S$" prefix is applied by hand rather than through Intl's currency
 * style. In the en-SG locale Intl renders SGD as a bare "$", which is
 * indistinguishable from US dollars — unacceptable on a client-facing
 * statement of someone's savings.
 */
export function formatSgd(value: Maybe, options?: { decimals?: number }): string {
  if (isMissing(value)) return NOT_AVAILABLE;
  const decimals = options?.decimals ?? 2;
  const amount = new Intl.NumberFormat(SG_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
  return `${value < 0 ? "−" : ""}S$${amount}`;
}

/**
 * Money in a fund's own currency, for NAV display. `USD 12.4501`
 *
 * Always shows the ISO code rather than a symbol, because a fund priced in
 * USD, HKD or SGD would otherwise all render as "$". These values are shown
 * for reference only and are never summed into a client portfolio — see the
 * currency decision in the Implementation Agreement.
 */
export function formatCurrency(
  value: Maybe,
  currency: string,
  options?: { decimals?: number },
): string {
  if (isMissing(value)) return NOT_AVAILABLE;
  const decimals = options?.decimals ?? 4;
  const amount = new Intl.NumberFormat(SG_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
  return `${value < 0 ? "−" : ""}${currency.toUpperCase()} ${amount}`;
}

/**
 * A stored decimal fraction rendered as a percentage.
 * `formatPercent(0.0523)` → `5.23%`
 */
export function formatPercent(
  fraction: Maybe,
  options?: { decimals?: number; signed?: boolean },
): string {
  if (isMissing(fraction)) return NOT_AVAILABLE;
  const decimals = options?.decimals ?? 2;
  const formatted = new Intl.NumberFormat(SG_LOCALE, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: options?.signed ? "exceptZero" : "auto",
  }).format(fraction);
  return formatted;
}

/** Signed money, for gain/loss. `+S$1,234.00` / `−S$56.00` / `S$0.00` */
export function formatSignedSgd(value: Maybe): string {
  if (isMissing(value)) return NOT_AVAILABLE;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatSgd(Math.abs(value))}`;
}

/** `04 Aug 2026` */
export function formatSgDate(value: Date | string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat(SG_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: SG_TIMEZONE,
  }).format(date);
}

/** `04 Aug 2026, 3:45 pm` */
export function formatSgDateTime(value: Date | string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat(SG_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: SG_TIMEZONE,
  }).format(date);
}

/**
 * Whole days between two dates, in Singapore time.
 *
 * Compares calendar dates rather than exact instants, so a review due
 * "today" reads as 0 days regardless of the time of day it is opened.
 */
export function daysBetweenSg(from: Date | string, to: Date | string): number {
  const startOfSgDay = (value: Date | string) => {
    const date = typeof value === "string" ? new Date(value) : value;
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: SG_TIMEZONE,
    }).format(date);
    return Date.parse(`${parts}T00:00:00Z`);
  };
  return Math.round((startOfSgDay(to) - startOfSgDay(from)) / 86_400_000);
}
