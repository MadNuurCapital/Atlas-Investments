import type { FundDataProvider, FetchResult, NavObservation } from "./provider";
import { unixToISODate } from "./provider";

/**
 * Yahoo Finance adapter.
 *
 * IMPORTANT, and repeated in the README and the admin screen: Yahoo data is
 * NOT licensed for commercial redistribution. It is appropriate for internal
 * and prototype use. Whether it may appear in client-facing output is a
 * compliance decision for the firm, not a technical one. This adapter is
 * built to be replaced.
 *
 * Called only from the server. Never from the browser — the request would
 * expose the app's traffic pattern, break on CORS, and put an unvetted
 * third-party response inside the user's page.
 */

const CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

/** A slow source must not hold a scheduled run open indefinitely. */
const TIMEOUT_MS = 8_000;

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        longName?: string;
        shortName?: string;
        currency?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
    error?: { description?: string; code?: string } | null;
  };
};

export const yahooProvider: FundDataProvider = {
  id: "yahoo",
  label: "Yahoo Finance",
  canFetch: true,

  async fetch(sourceIdentifier: string): Promise<FetchResult> {
    const symbol = sourceIdentifier.trim();
    if (!symbol) return { ok: false, error: "No symbol configured" };

    const url = `${CHART_ENDPOINT}/${encodeURIComponent(symbol)}?range=5y&interval=1d`;

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Yahoo rejects requests with no user agent.
          "User-Agent": "AtlasInvestments/1.0 (internal advisory tool)",
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "network error";
      return { ok: false, error: `Could not reach Yahoo Finance: ${reason}` };
    }

    if (!response.ok) {
      // 404 is the common and informative case: the symbol does not exist,
      // which usually means a typo or a fund Yahoo simply does not carry.
      return {
        ok: false,
        error:
          response.status === 404
            ? `Yahoo Finance does not recognise the symbol "${symbol}"`
            : `Yahoo Finance returned ${response.status}`,
      };
    }

    let payload: YahooChartResponse;
    try {
      payload = (await response.json()) as YahooChartResponse;
    } catch {
      return { ok: false, error: "Yahoo Finance returned something unreadable" };
    }

    if (payload.chart?.error) {
      return {
        ok: false,
        error: payload.chart.error.description ?? "Yahoo Finance reported an error",
      };
    }

    const result = payload.chart?.result?.[0];
    if (!result) {
      return { ok: false, error: `No data returned for "${symbol}"` };
    }

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    // Yahoo returns nulls for non-trading days. Dropping them is correct;
    // carrying a null forward would invent a price that never existed.
    const history: NavObservation[] = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const close = closes[i];
      if (typeof close !== "number" || !Number.isFinite(close) || close < 0) continue;
      history.push({ date: unixToISODate(timestamps[i]), nav: close });
    }

    const meta = result.meta ?? {};
    const latest = history.at(-1) ?? null;

    return {
      ok: true,
      quote: {
        name: meta.longName ?? meta.shortName ?? null,
        currency: meta.currency ?? null,
        nav:
          typeof meta.regularMarketPrice === "number"
            ? meta.regularMarketPrice
            : (latest?.nav ?? null),
        navDate: meta.regularMarketTime
          ? unixToISODate(meta.regularMarketTime)
          : (latest?.date ?? null),
      },
      history,
    };
  },
};
