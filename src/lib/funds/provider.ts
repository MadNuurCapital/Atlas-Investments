/**
 * Fund data providers.
 *
 * The point of this interface is that no part of the application knows or
 * cares where a NAV came from. Yahoo Finance is a prototype source with two
 * real problems — patchy coverage of Singapore-distributed insurer-linked
 * funds, and no licence for commercial redistribution — so it is deliberately
 * one implementation among several rather than the foundation.
 *
 * Three implementations:
 *   manual — an administrator types the figures from a factsheet. Always
 *            available, works for every fund, never fails.
 *   csv    — bulk NAV history, pasted or uploaded.
 *   yahoo  — automatic daily refresh for funds with a VERIFIED symbol.
 *
 * Replacing Yahoo with a licensed provider means writing one more adapter.
 * Nothing above this interface changes.
 */

export type NavObservation = {
  /** `YYYY-MM-DD` */
  date: string;
  nav: number;
};

export type FundQuote = {
  /** What the source calls this instrument, for the admin to eyeball. */
  name: string | null;
  currency: string | null;
  nav: number | null;
  navDate: string | null;
};

export type FetchResult =
  | { ok: true; quote: FundQuote; history: NavObservation[] }
  | { ok: false; error: string };

export type FundDataProvider = {
  readonly id: "manual" | "csv" | "yahoo";
  readonly label: string;
  /**
   * Whether this provider can fetch on its own. Manual and CSV cannot —
   * they are driven by a person — so the scheduler skips them rather than
   * logging a failure for a fund that is working exactly as intended.
   */
  readonly canFetch: boolean;

  /** Look up one instrument. Never throws; failure is a value. */
  fetch(sourceIdentifier: string): Promise<FetchResult>;
};

/**
 * The manual provider.
 *
 * Deliberately not a stub: a fund with no automatic source is a fully
 * supported, permanently valid state, not a degraded one. Calling fetch on
 * it is a programming error, so it says so plainly.
 */
export const manualProvider: FundDataProvider = {
  id: "manual",
  label: "Manual entry",
  canFetch: false,
  async fetch() {
    return {
      ok: false,
      error:
        "This fund is maintained by hand. Update its NAV from the fund editor.",
    };
  },
};

export const csvProvider: FundDataProvider = {
  id: "csv",
  label: "CSV / pasted import",
  canFetch: false,
  async fetch() {
    return {
      ok: false,
      error: "This fund is updated by import. Paste or upload its NAV history.",
    };
  },
};

/** Parse a `YYYY-MM-DD` out of a unix timestamp in seconds. */
export function unixToISODate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}
