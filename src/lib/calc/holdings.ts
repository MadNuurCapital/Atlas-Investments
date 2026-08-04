import { addMonths, parseDate, toISODate } from "./dates";
import { fromCents, roundMoney, sumMoney, toCents } from "./money";

/**
 * Holding performance.
 *
 * The method is deliberately simple and is labelled "Simple gain/loss"
 * everywhere it appears. It does NOT account for the timing of cash flows.
 * It is not time-weighted return and it is not XIRR, and the application
 * never claims otherwise.
 *
 *   total_contributed = initial lump sum
 *                     + recurring contributions actually due
 *                     + additional lump sums
 *   adjusted_value    = current value + withdrawals + cash dividends
 *   gain_or_loss      = adjusted_value − total_contributed
 *   percentage        = gain_or_loss ÷ total_contributed
 *
 * Two rules that matter more than the formula:
 *
 *   1. With no contributions there is no percentage. The result is `null`,
 *      never 0%. Zero would read as "no gain", which is a different and
 *      false claim.
 *   2. With no recorded current value there is no gain/loss at all. An
 *      unvalued holding returns `null`, not a figure derived from
 *      pretending the value is zero.
 */

export type HoldingStatus = "active" | "paused" | "matured" | "closed" | "lapsed";

export type TransactionType =
  | "additional_lump_sum"
  | "withdrawal"
  | "dividend"
  | "contribution_change"
  | "adjustment";

export type TransactionInput = {
  type: TransactionType;
  /** Used by every type except contribution_change. */
  amount?: number | null;
  /** Used only by contribution_change. */
  newMonthlyAmount?: number | null;
  effectiveDate: string;
};

export type HoldingInput = {
  initialLumpSum: number;
  monthlyContribution: number;
  startDate: string;
  currentValue: number | null;
  /** The date recurring contributions stopped, if they have. */
  contributionsCeasedOn?: string | null;
  /** Advisor override for when a provider statement disagrees. */
  contributedOverride?: number | null;
  transactions: readonly TransactionInput[];
};

export type HoldingTotals = {
  /** Number of monthly contributions due between start and the as-of date. */
  contributionsPaid: number;
  recurringContributed: number;
  additionalContributed: number;
  totalContributed: number;
  /** True when the advisor overrode the derived figure. */
  isOverridden: boolean;
  withdrawals: number;
  dividends: number;
  adjustments: number;
  /** The monthly contribution in force on the as-of date. */
  monthlyContributionNow: number;
  /** null when no current value has been recorded. */
  adjustedValue: number | null;
  gainLoss: number | null;
  /** Decimal fraction (0.05 = 5%). null when there is nothing to measure. */
  gainLossFraction: number | null;
};

/** Guards against a runaway loop from a corrupt start date. */
const MAX_MONTHS = 1200;

/**
 * The dates on which a monthly contribution falls due.
 *
 * Contributions are treated as paid on the monthly anniversary of the start
 * date, beginning on the start date itself. A holding started 15 Jan and
 * measured on 15 Mar has had three payments — Jan, Feb and Mar.
 *
 * Month-ends clamp rather than roll over (see addMonths), so a holding
 * started on the 31st contributes on the 28th/29th in February and returns
 * to the 31st afterwards.
 */
export function contributionDueDates(
  startDate: string,
  asOf: string,
  ceasedOn?: string | null,
): string[] {
  const start = parseDate(startDate);
  const end = parseDate(asOf);
  const ceased = ceasedOn ? parseDate(ceasedOn) : null;

  // Contributions stop on the ceased date, or the as-of date, whichever
  // comes first.
  const limit = ceased && ceased.getTime() < end.getTime() ? ceased : end;
  if (limit.getTime() < start.getTime()) return [];

  const dates: string[] = [];
  for (let month = 0; month < MAX_MONTHS; month += 1) {
    const due = addMonths(start, month);
    if (due.getTime() > limit.getTime()) break;
    dates.push(toISODate(due));
  }
  return dates;
}

/**
 * The monthly contribution in force on a given date.
 *
 * Starts at the holding's original amount, then applies each recorded
 * contribution change whose effective date has arrived. Changes are sorted
 * defensively — advisors record them in whatever order they remember.
 */
export function monthlyContributionOn(
  holding: Pick<HoldingInput, "monthlyContribution" | "transactions">,
  onDate: string,
): number {
  const target = parseDate(onDate).getTime();

  const changes = holding.transactions
    .filter((t) => t.type === "contribution_change")
    .map((t) => ({
      at: parseDate(t.effectiveDate).getTime(),
      amount: t.newMonthlyAmount ?? 0,
    }))
    .sort((a, b) => a.at - b.at);

  let amount = holding.monthlyContribution;
  for (const change of changes) {
    if (change.at <= target) amount = change.amount;
    else break;
  }
  return amount;
}

/**
 * Everything derived from one holding, as at a date.
 *
 * `asOf` defaults to today. During a review it is set to the review date, so
 * a snapshot records what was true then rather than what is true now.
 */
export function computeHoldingTotals(
  holding: HoldingInput,
  asOf: string = toISODate(new Date()),
): HoldingTotals {
  const dueDates = contributionDueDates(
    holding.startDate,
    asOf,
    holding.contributionsCeasedOn,
  );

  // Sum in cents so a hundred monthly contributions do not drift.
  const recurringCents = dueDates.reduce(
    (total, dueDate) => total + toCents(monthlyContributionOn(holding, dueDate)),
    0,
  );
  const recurringContributed = fromCents(recurringCents);

  const asOfTime = parseDate(asOf).getTime();
  const upToAsOf = holding.transactions.filter(
    (t) => parseDate(t.effectiveDate).getTime() <= asOfTime,
  );

  const sumOf = (type: TransactionType) =>
    sumMoney(upToAsOf.filter((t) => t.type === type).map((t) => t.amount ?? 0));

  const additionalContributed = sumOf("additional_lump_sum");
  const withdrawals = sumOf("withdrawal");
  const dividends = sumOf("dividend");
  const adjustments = sumOf("adjustment");

  const derivedTotal = sumMoney([
    holding.initialLumpSum,
    recurringContributed,
    additionalContributed,
  ]);

  const isOverridden =
    holding.contributedOverride !== null && holding.contributedOverride !== undefined;
  const totalContributed = isOverridden
    ? roundMoney(holding.contributedOverride as number)
    : derivedTotal;

  // No recorded value means no answer. Treating a missing value as zero
  // would report a catastrophic loss on a holding nobody has valued yet.
  if (holding.currentValue === null || holding.currentValue === undefined) {
    return {
      contributionsPaid: dueDates.length,
      recurringContributed,
      additionalContributed,
      totalContributed,
      isOverridden,
      withdrawals,
      dividends,
      adjustments,
      monthlyContributionNow: monthlyContributionOn(holding, asOf),
      adjustedValue: null,
      gainLoss: null,
      gainLossFraction: null,
    };
  }

  const adjustedValue = sumMoney([holding.currentValue, withdrawals, dividends]);
  const gainLoss = sumMoney([adjustedValue, -totalContributed]);

  return {
    contributionsPaid: dueDates.length,
    recurringContributed,
    additionalContributed,
    totalContributed,
    isOverridden,
    withdrawals,
    dividends,
    adjustments,
    monthlyContributionNow: monthlyContributionOn(holding, asOf),
    adjustedValue,
    gainLoss,
    // Dividing by zero contributions is meaningless, not infinite.
    gainLossFraction: totalContributed > 0 ? gainLoss / totalContributed : null,
  };
}

export type PortfolioTotals = {
  totalContributed: number;
  currentValue: number | null;
  adjustedValue: number | null;
  gainLoss: number | null;
  gainLossFraction: number | null;
  monthlyContribution: number;
  dividends: number;
  withdrawals: number;
  /** Holdings with no recorded value, so the totals are incomplete. */
  unvaluedCount: number;
};

/** Statuses that count toward a client's headline figures. */
export const CONTRIBUTING_STATUSES: readonly HoldingStatus[] = ["active"];
export const HEADLINE_STATUSES: readonly HoldingStatus[] = ["active", "paused"];

/**
 * Roll several holdings into the client's headline figures.
 *
 * Closed, matured and lapsed holdings are excluded from the headline — they
 * are no longer part of what the client holds — but remain visible in their
 * own section and in history. Paused holdings keep their value but
 * contribute nothing to the monthly total, because contributions stopped.
 */
export function computePortfolioTotals(
  holdings: readonly { status: HoldingStatus; totals: HoldingTotals }[],
): PortfolioTotals {
  const headline = holdings.filter((h) => HEADLINE_STATUSES.includes(h.status));

  const valued = headline.filter((h) => h.totals.adjustedValue !== null);
  const unvaluedCount = headline.length - valued.length;

  const totalContributed = sumMoney(headline.map((h) => h.totals.totalContributed));
  const dividends = sumMoney(headline.map((h) => h.totals.dividends));
  const withdrawals = sumMoney(headline.map((h) => h.totals.withdrawals));

  const monthlyContribution = sumMoney(
    headline
      .filter((h) => CONTRIBUTING_STATUSES.includes(h.status))
      .map((h) => h.totals.monthlyContributionNow),
  );

  if (valued.length === 0) {
    return {
      totalContributed,
      currentValue: null,
      adjustedValue: null,
      gainLoss: null,
      gainLossFraction: null,
      monthlyContribution,
      dividends,
      withdrawals,
      unvaluedCount,
    };
  }

  const adjustedValue = sumMoney(valued.map((h) => h.totals.adjustedValue as number));
  const currentValue = sumMoney(
    valued.map((h) => (h.totals.adjustedValue as number) - h.totals.withdrawals - h.totals.dividends),
  );
  const gainLoss = sumMoney([adjustedValue, -totalContributed]);

  return {
    totalContributed,
    currentValue,
    adjustedValue,
    gainLoss,
    gainLossFraction: totalContributed > 0 ? gainLoss / totalContributed : null,
    monthlyContribution,
    dividends,
    withdrawals,
    unvaluedCount,
  };
}
