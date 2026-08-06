import type { Fund, FundRiskLevel } from "@/lib/supabase/types";
import { daysBetween, toISODate } from "@/lib/calc/dates";

/**
 * Fund labels and the data-health rule.
 *
 * Deliberately in its own module with NO server-only import, because Client
 * Components need these constants. Keeping them in `lib/data/funds.ts`
 * alongside the database queries would drag the server-only guard — and the
 * Supabase server client — into the browser bundle.
 */

export const RISK_LABELS: Record<FundRiskLevel, string> = {
  very_low: "Very low",
  low: "Low",
  moderate: "Moderate",
  moderately_high: "Moderately high",
  high: "High",
  very_high: "Very high",
};

export type DataHealth = "current" | "stale" | "failed" | "missing" | "manual";

export const HEALTH_LABELS: Record<DataHealth, string> = {
  current: "Current",
  stale: "Stale",
  failed: "Refresh failed",
  missing: "No NAV recorded",
  manual: "Manually managed",
};

/**
 * How trustworthy a fund's data is right now.
 *
 * "Manual" is a healthy state, not a degraded one — a fund maintained from
 * factsheets is working exactly as intended and must not be reported as a
 * problem. Only genuine problems are: a fetch that failed, a NAV that has
 * gone stale, and a fund with no NAV at all.
 */
export function fundDataHealth(fund: Fund, staleAfterDays = 5): DataHealth {
  if (fund.latest_nav === null || fund.nav_date === null) return "missing";
  if (fund.last_refresh_status === "failed") return "failed";
  if (!fund.auto_refresh_enabled) return "manual";
  return daysBetween(fund.nav_date, toISODate(new Date())) > staleAfterDays
    ? "stale"
    : "current";
}
