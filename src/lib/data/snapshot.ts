import "server-only";

import { getClient, getClientValueHistory } from "./clients";
import { getReview } from "./reviews";
import { requireProfile } from "@/lib/auth/dal";
import { toISODate } from "@/lib/calc/dates";

/**
 * Client-facing snapshot data.
 *
 * This function is the privacy boundary for client output. It builds a
 * NEW object containing only what a client may see. Internal notes,
 * discussion notes, private contact details, database ids and advisor
 * contact details are never read into it — so they cannot leak into the
 * card or the PDF even by accident, because they are not in the object at
 * all. Hiding fields in the template would be one careless edit away from
 * exposure; not fetching them is structural.
 */

export type NameStyle = "full" | "first" | "initials";

function displayName(fullName: string, style: NameStyle): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Client";

  if (style === "first") return parts[0];
  if (style === "initials") {
    return parts.map((part) => part[0].toUpperCase()).join("");
  }
  return fullName.trim();
}

export type SnapshotHolding = {
  provider: string;
  productName: string;
  fundName: string;
  monthlyContribution: number;
  totalContributed: number;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossFraction: number | null;
};

export type SnapshotData = {
  advisorName: string;
  clientName: string;
  reviewDate: string;
  nextReviewDate: string | null;
  investmentGoal: string | null;
  totalContributed: number;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossFraction: number | null;
  monthlyContribution: number;
  dividendsThisPeriod: number;
  valueHistory: { date: string; value: number; contributed: number }[];
  holdings: SnapshotHolding[];
  generatedOn: string;
  isCorrected: boolean;
};

export async function getSnapshot(
  clientId: string,
  options: { reviewId?: string; nameStyle?: NameStyle } = {},
): Promise<SnapshotData | null> {
  const advisor = await requireProfile();

  const review = options.reviewId ? await getReview(options.reviewId) : null;
  const asOf = review?.review_date ?? toISODate(new Date());

  const [client, history] = await Promise.all([
    getClient(clientId, asOf),
    getClientValueHistory(clientId),
  ]);

  if (!client) return null;
  if (review && review.client_id !== clientId) return null;

  const { portfolio } = client;

  // Goals come from the holdings, not from the internal notes field.
  const goals = client.holdings
    .map((holding) => holding.investment_goal)
    .filter((goal): goal is string => Boolean(goal?.trim()));

  return {
    advisorName: advisor.full_name || "Your adviser",
    clientName: displayName(client.full_name, options.nameStyle ?? "full"),
    reviewDate: asOf,
    nextReviewDate: client.next_review_date,
    investmentGoal: goals.length > 0 ? [...new Set(goals)].join(" · ") : null,
    totalContributed: portfolio.totalContributed,
    currentValue: portfolio.adjustedValue,
    gainLoss: portfolio.gainLoss,
    gainLossFraction: portfolio.gainLossFraction,
    monthlyContribution: portfolio.monthlyContribution,
    dividendsThisPeriod: portfolio.dividends,
    valueHistory: history,
    holdings: client.holdings
      .filter((holding) => holding.status === "active" || holding.status === "paused")
      .map((holding) => ({
        provider: holding.provider,
        productName: holding.product_name,
        fundName: holding.fundDisplayName,
        monthlyContribution: holding.totals.monthlyContributionNow,
        totalContributed: holding.totals.totalContributed,
        currentValue: holding.totals.adjustedValue,
        gainLoss: holding.totals.gainLoss,
        gainLossFraction: holding.totals.gainLossFraction,
      })),
    generatedOn: toISODate(new Date()),
    isCorrected: (review?.correction_count ?? 0) > 0,
  };
}
