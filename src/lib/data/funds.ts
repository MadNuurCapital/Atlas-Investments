import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Fund,
  FundAllocation,
  FundNavPoint,
  FundRiskLevel,
} from "@/lib/supabase/types";
import { fundDataHealth, type DataHealth } from "@/lib/funds/labels";

// Re-exported so server components can keep importing from one place. The
// definitions live in lib/funds/labels.ts because Client Components need
// them too, and this module is server-only.
export { RISK_LABELS, HEALTH_LABELS, fundDataHealth } from "@/lib/funds/labels";
export type { DataHealth } from "@/lib/funds/labels";

/**
 * Fund Centre data access.
 *
 * Fund data is firm-wide reference data: every active user reads it, only an
 * administrator writes it. That is enforced by RLS, not here.
 */

export type FundListOptions = {
  search?: string;
  category?: string;
  risk?: FundRiskLevel;
  shariahOnly?: boolean;
  watchlistOnly?: boolean;
  includeArchived?: boolean;
};

export type FundListItem = Fund & { isWatched: boolean; health: DataHealth };

export async function listFunds(options: FundListOptions = {}): Promise<FundListItem[]> {
  const supabase = await createClient();

  const [{ data: watchlist }, staleAfterDays] = await Promise.all([
    supabase.from("fund_watchlists").select("fund_id"),
    getStaleThreshold(),
  ]);

  const watched = new Set((watchlist ?? []).map((row) => row.fund_id));

  let query = supabase.from("funds").select("*").order("name", { ascending: true });

  if (!options.includeArchived) query = query.eq("is_archived", false);
  if (options.category) query = query.eq("category", options.category);
  if (options.risk) query = query.eq("risk_level", options.risk);
  if (options.shariahOnly) query = query.eq("shariah_status", "shariah");

  const search = options.search?.trim();
  if (search) {
    const safe = search.replace(/[,()]/g, " ");
    query = query.or(
      `name.ilike.%${safe}%,share_class.ilike.%${safe}%,isin.ilike.%${safe}%,fund_manager.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load funds: ${error.message}`);

  const funds = (data ?? []).map((fund) => ({
    ...fund,
    isWatched: watched.has(fund.id),
    health: fundDataHealth(fund, staleAfterDays),
  }));

  return options.watchlistOnly ? funds.filter((fund) => fund.isWatched) : funds;
}

export type FundDetail = FundListItem & {
  allocations: FundAllocation[];
  navHistory: FundNavPoint[];
  /** How many of *this advisor's own* clients hold it. Never firm-wide. */
  ownHoldingCount: number;
};

export async function getFund(fundId: string): Promise<FundDetail | null> {
  const supabase = await createClient();
  const staleAfterDays = await getStaleThreshold();

  const { data, error } = await supabase
    .from("funds")
    .select("*, fund_allocations(*), fund_nav_history(*)")
    .eq("id", fundId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: watch } = await supabase
    .from("fund_watchlists")
    .select("id")
    .eq("fund_id", fundId)
    .maybeSingle();

  // Row Level Security limits this count to the signed-in advisor's own
  // clients. There is no firm-wide "who holds this fund" anywhere.
  const { count } = await supabase
    .from("client_holdings")
    .select("id", { count: "exact", head: true })
    .eq("fund_id", fundId)
    .is("archived_at", null);

  const { fund_allocations, fund_nav_history, ...fund } = data;

  return {
    ...(fund as Fund),
    isWatched: Boolean(watch),
    health: fundDataHealth(fund as Fund, staleAfterDays),
    allocations: (fund_allocations ?? []).sort(
      (a: FundAllocation, b: FundAllocation) => a.sort_order - b.sort_order,
    ),
    navHistory: (fund_nav_history ?? []).sort(
      (a: FundNavPoint, b: FundNavPoint) => a.nav_date.localeCompare(b.nav_date),
    ),
    ownHoldingCount: count ?? 0,
  };
}

export async function getStaleThreshold(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "nav_stale_after_days")
    .maybeSingle();

  const value = Number(data?.value ?? 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

/** Indicative FX for showing a rough SGD equivalent beside a foreign NAV. */
export async function getLatestRate(currency: string) {
  if (currency.toUpperCase() === "SGD") return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("currency_rates")
    .select("*")
    .eq("currency_code", currency.toUpperCase())
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function listCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("funds")
    .select("category")
    .eq("is_archived", false)
    .not("category", "is", null);

  return [...new Set((data ?? []).map((row) => row.category as string))].sort();
}

export async function listRefreshRuns(limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fund_refresh_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
