import type { Config } from "@netlify/functions";

/**
 * Daily fund-data refresh.
 *
 * This function does not do the work. It calls the application's refresh
 * endpoint, which processes a batch of funds and returns.
 *
 * Why batches: Netlify's scheduled functions have a short execution limit,
 * and fetching forty funds serially from an external source will exceed it.
 * A single long call would time out silently and leave the log claiming
 * nothing happened. Instead each run takes the least-recently-refreshed
 * slice, so every fund comes round within a few days at the outside — and
 * on a normal-sized fund list, within a single run.
 *
 * Failures never destroy data: see src/lib/funds/refresh.ts.
 */

export default async function handler() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.URL;
  const secret = process.env.FUND_REFRESH_SECRET;

  if (!siteUrl || !secret) {
    console.error(
      "[fund-refresh] NEXT_PUBLIC_SITE_URL and FUND_REFRESH_SECRET must both be set",
    );
    return new Response("Not configured", { status: 500 });
  }

  const response = await fetch(`${siteUrl}/api/fund-refresh?batch=20&by=schedule`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();
  console.log(`[fund-refresh] ${response.status} ${body}`);

  return new Response(body, { status: response.status });
}

export const config: Config = {
  // 21:00 UTC is 05:00 Singapore — after most fund houses have published
  // the previous day's NAV, and before the working day starts here.
  schedule: "0 21 * * *",
};
