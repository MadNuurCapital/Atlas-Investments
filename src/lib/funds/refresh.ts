import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { yahooProvider } from "./yahoo";
import { trailingReturn, yearToDateReturn } from "./nav-import";
import type { FundDataProvider, NavObservation } from "./provider";

/**
 * The scheduled fund-data refresh.
 *
 * Three properties matter more than speed:
 *
 *   1. A FAILURE NEVER DESTROYS DATA. New NAV rows are written only on
 *      success. A fund whose symbol breaks keeps its entire history and is
 *      simply marked stale with the reason recorded. There is no code path
 *      here that deletes a NAV.
 *
 *   2. IT WORKS IN BATCHES. Netlify's scheduled functions have a short
 *      execution limit, and forty funds fetched serially will exceed it. The
 *      job processes a slice per invocation, oldest-refreshed first, so
 *      every fund comes round rather than the first few being refreshed
 *      forever and the rest never.
 *
 *   3. IT USES PRIVILEGED CREDENTIALS FOR FUND TABLES ONLY. The service-role
 *      key bypasses Row Level Security, so this module touches funds, NAV
 *      history and refresh logs — and nothing else. It must never read or
 *      write client data.
 */

const PROVIDERS: Record<string, FundDataProvider> = {
  yahoo: yahooProvider,
};

export type RefreshOutcome = {
  fundId: string;
  fundName: string;
  ok: boolean;
  message: string;
  navsWritten: number;
};

export type RefreshSummary = {
  runId: string | null;
  attempted: number;
  succeeded: number;
  failed: number;
  outcomes: RefreshOutcome[];
};

export async function refreshFunds(options?: {
  batchSize?: number;
  fundId?: string;
  triggeredBy?: string;
}): Promise<RefreshSummary> {
  const batchSize = options?.batchSize ?? 12;
  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from("fund_refresh_runs")
    .insert({ triggered_by: options?.triggeredBy ?? "schedule" })
    .select("id")
    .single();

  let query = supabase
    .from("funds")
    .select(
      "id, name, share_class, source_identifier, data_source, currency, perf_manual_keys",
    )
    .eq("auto_refresh_enabled", true)
    .eq("is_archived", false);

  if (options?.fundId) {
    query = query.eq("id", options.fundId);
  } else {
    // Least-recently-refreshed first, nulls first. Every fund comes round.
    query = query
      .order("last_refresh_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);
  }

  const { data: funds, error } = await query;

  if (error) {
    await finishRun(run?.id, "failed", 0, 0, 0, [], error.message);
    return { runId: run?.id ?? null, attempted: 0, succeeded: 0, failed: 0, outcomes: [] };
  }

  const outcomes: RefreshOutcome[] = [];

  for (const fund of funds ?? []) {
    const provider = PROVIDERS[fund.data_source];

    // Manual and CSV funds are working exactly as intended. Skipping them
    // silently — rather than logging a failure — keeps Data Health honest.
    if (!provider?.canFetch || !fund.source_identifier) continue;

    const outcome = await refreshOne(supabase, provider, fund);
    outcomes.push(outcome);
  }

  const succeeded = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - succeeded;
  const status = failed === 0 ? "success" : succeeded === 0 ? "failed" : "partial";

  await finishRun(run?.id, status, outcomes.length, succeeded, failed, outcomes, null);

  return {
    runId: run?.id ?? null,
    attempted: outcomes.length,
    succeeded,
    failed,
    outcomes,
  };
}

type FundRow = {
  id: string;
  name: string;
  share_class: string;
  source_identifier: string | null;
  data_source: string;
  currency: string;
  perf_manual_keys: string[];
};

async function refreshOne(
  supabase: ReturnType<typeof createAdminClient>,
  provider: FundDataProvider,
  fund: FundRow,
): Promise<RefreshOutcome> {
  const label = `${fund.name} ${fund.share_class}`.trim();
  const result = await provider.fetch(fund.source_identifier as string);

  if (!result.ok) {
    // Record the failure against the fund and move on. Crucially, no NAV
    // rows are touched: the fund keeps everything it already had.
    await supabase
      .from("funds")
      .update({
        last_refresh_at: new Date().toISOString(),
        last_refresh_status: "failed",
        last_refresh_error: result.error,
      })
      .eq("id", fund.id);

    return { fundId: fund.id, fundName: label, ok: false, message: result.error, navsWritten: 0 };
  }

  const history = result.history;

  if (history.length === 0) {
    await supabase
      .from("funds")
      .update({
        last_refresh_at: new Date().toISOString(),
        last_refresh_status: "failed",
        last_refresh_error: "The source returned no usable prices",
      })
      .eq("id", fund.id);

    return {
      fundId: fund.id,
      fundName: label,
      ok: false,
      message: "No usable prices returned",
      navsWritten: 0,
    };
  }

  // Upsert so re-running is harmless and a revised price replaces the old one
  // for that date, rather than colliding.
  const { error: navError } = await supabase.from("fund_nav_history").upsert(
    history.map((point: NavObservation) => ({
      fund_id: fund.id,
      nav_date: point.date,
      nav: point.nav,
      source: "yahoo" as const,
    })),
    { onConflict: "fund_id,nav_date" },
  );

  if (navError) {
    await supabase
      .from("funds")
      .update({
        last_refresh_at: new Date().toISOString(),
        last_refresh_status: "failed",
        last_refresh_error: `Could not store prices: ${navError.message}`,
      })
      .eq("id", fund.id);

    return {
      fundId: fund.id,
      fundName: label,
      ok: false,
      message: navError.message,
      navsWritten: 0,
    };
  }

  const latest = history.at(-1) as NavObservation;

  // Performance is recomputed from stored history rather than taken from the
  // source, so every fund's figures are calculated the same way whatever
  // their origin — and a fund without enough history reports null, not zero.
  //
  // A figure an administrator typed from a factsheet is never overwritten.
  // This job used to write all five unconditionally, which meant a fund with
  // three weeks of downloaded prices would compute NULL for its five-year
  // return and erase the number a person had read off a published document.
  // The longer the period, the more certain the loss — exactly backwards.
  const manual = new Set(fund.perf_manual_keys ?? []);
  const derived: Record<string, number | null> = {};
  const keep = (key: string, column: string, compute: () => number | null) => {
    if (!manual.has(key)) derived[column] = compute();
  };

  keep("ytd", "perf_ytd", () => yearToDateReturn(history));
  keep("1m", "perf_1m", () => trailingReturn(history, 1));
  keep("6m", "perf_6m", () => trailingReturn(history, 6));
  keep("1y", "perf_1y", () => trailingReturn(history, 12));
  keep("3y", "perf_3y", () => trailingReturn(history, 36));
  keep("5y", "perf_5y", () => trailingReturn(history, 60));

  await supabase
    .from("funds")
    .update({
      latest_nav: result.quote.nav ?? latest.nav,
      nav_date: result.quote.navDate ?? latest.date,
      ...derived,
      last_refresh_at: new Date().toISOString(),
      last_refresh_status: "success",
      last_refresh_error: null,
    })
    .eq("id", fund.id);

  return {
    fundId: fund.id,
    fundName: label,
    ok: true,
    message: `Updated to ${latest.date}`,
    navsWritten: history.length,
  };
}

async function finishRun(
  runId: string | undefined,
  status: "success" | "partial" | "failed",
  attempted: number,
  succeeded: number,
  failed: number,
  outcomes: RefreshOutcome[],
  errorMessage: string | null,
): Promise<void> {
  if (!runId) return;
  const supabase = createAdminClient();

  await supabase
    .from("fund_refresh_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      funds_attempted: attempted,
      funds_succeeded: succeeded,
      funds_failed: failed,
      details: outcomes,
      error_message: errorMessage,
    })
    .eq("id", runId);
}
