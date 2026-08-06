import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SCENARIO_RATES,
  type ScenarioRates,
} from "@/lib/calc/projections";

/**
 * Firm-wide defaults, editable by an administrator.
 *
 * Each getter falls back to a sensible constant if the setting is missing or
 * malformed. A calculator that refused to open because a settings row had
 * been deleted would be worse than one that quietly uses the documented
 * default.
 */

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getScenarioRates(): Promise<ScenarioRates> {
  const value = await getSetting<Partial<ScenarioRates>>(
    "scenario_rates",
    DEFAULT_SCENARIO_RATES,
  );

  const pick = (key: keyof ScenarioRates) => {
    const candidate = Number(value?.[key]);
    // Guard the range: a corrupt setting must not silently produce a
    // projection at 5000% a year.
    return Number.isFinite(candidate) && candidate > -0.95 && candidate <= 1
      ? candidate
      : DEFAULT_SCENARIO_RATES[key];
  };

  return {
    conservative: pick("conservative"),
    moderate: pick("moderate"),
    growth: pick("growth"),
  };
}

export async function getAffordabilityBands() {
  const value = await getSetting("affordability_bands", {
    low: 0.1,
    medium: 0.2,
    high: 0.3,
  });

  const pick = (key: "low" | "medium" | "high", fallback: number) => {
    const candidate = Number((value as Record<string, unknown>)?.[key]);
    return Number.isFinite(candidate) && candidate > 0 && candidate <= 1
      ? candidate
      : fallback;
  };

  return {
    low: pick("low", 0.1),
    medium: pick("medium", 0.2),
    high: pick("high", 0.3),
  };
}

export async function getHajjDefaults() {
  const value = await getSetting("hajj_cost_default", { cost: 30_000, inflation: 0.05 });

  const cost = Number((value as Record<string, unknown>)?.cost);
  const inflation = Number((value as Record<string, unknown>)?.inflation);

  return {
    cost: Number.isFinite(cost) && cost > 0 ? cost : 30_000,
    inflation: Number.isFinite(inflation) && inflation >= 0 && inflation < 1 ? inflation : 0.05,
  };
}
