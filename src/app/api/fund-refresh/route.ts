import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { refreshFunds } from "@/lib/funds/refresh";

/**
 * The scheduled fund-data refresh endpoint.
 *
 * Called by the Netlify scheduled function once a day, and by an
 * administrator from the Data Health screen.
 *
 * Guarded by a shared secret rather than a user session: the scheduler has
 * no session. Without it, anyone who guessed the URL could drive traffic at
 * the upstream provider from our IP.
 *
 * The comparison is length-checked before the constant-time compare, since
 * timingSafeEqual throws on mismatched lengths.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorised(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = serverEnv.FUND_REFRESH_SECRET;

  if (provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchSize = Number(url.searchParams.get("batch") ?? "12");

  try {
    const summary = await refreshFunds({
      // Netlify's scheduled functions have a short execution limit, so the
      // job takes a slice per run rather than trying to do everything.
      batchSize: Number.isFinite(batchSize) ? Math.min(Math.max(batchSize, 1), 40) : 12,
      triggeredBy: url.searchParams.get("by") ?? "schedule",
    });

    return NextResponse.json({
      ok: true,
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
    });
  } catch (cause) {
    // A crash here must not look like a successful refresh.
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("[fund-refresh] run threw", cause);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
