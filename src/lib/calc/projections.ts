import { roundMoney } from "./money";

/**
 * The projection engine.
 *
 * Every calculator in Atlas is built from the functions below. They are pure:
 * no database, no React, no formatting. That is what makes them testable
 * against known answers, and it is why the maths can be trusted rather than
 * merely looking right on screen.
 *
 * ---------------------------------------------------------------------------
 * DOCUMENTED ASSUMPTIONS — these are shown beside every result in the UI
 * ---------------------------------------------------------------------------
 *
 * 1. Rates in, rates out are DECIMAL FRACTIONS. 0.05 means 5%.
 *
 * 2. Annual rates convert to monthly by EFFECTIVE compounding:
 *
 *        monthly = (1 + annual)^(1/12) − 1
 *
 *    not annual ÷ 12. The effective conversion means "5% a year" really
 *    compounds to 5% over twelve months. The nominal shortcut would compound
 *    to about 5.12%, quietly flattering every projection in the product.
 *
 * 3. Contributions arrive at the END of each month (an ordinary annuity).
 *    This is the more conservative of the two conventions — a payment at the
 *    start of the month earns one extra month of growth — and understating a
 *    projection is the safer error.
 *
 * 4. Zero-rate cases are separate code paths, not special values fed through
 *    the same formula. The annuity formula divides by the rate, so at 0% it
 *    would produce NaN or Infinity rather than the correct answer of
 *    payment × months.
 *
 * 5. Nothing is rounded until the end. Rounding each intermediate step would
 *    accumulate error across 480 months of a retirement projection.
 *
 * 6. NO FUNCTION HERE EVER TAKES A FUND'S PAST PERFORMANCE AS AN INPUT
 *    DEFAULT. Return assumptions come from the advisor or from the firm's
 *    configured scenario rates, never from history.
 */

/** Ten million percent a year is not a scenario; it is a typo. */
const MAX_ANNUAL_RATE = 1.0;
const MIN_ANNUAL_RATE = -0.95;
const MAX_MONTHS = 1200; // 100 years

export type ValidationIssue = { field: string; message: string };

export class ProjectionError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "ProjectionError";
  }
}

function assert(issues: ValidationIssue[]): void {
  if (issues.length > 0) throw new ProjectionError(issues);
}

export function validateRate(rate: number, field = "rate"): ValidationIssue[] {
  if (!Number.isFinite(rate)) {
    return [{ field, message: "Enter a return assumption as a number" }];
  }
  if (rate < MIN_ANNUAL_RATE) {
    return [{ field, message: "A return below −95% a year is not meaningful" }];
  }
  if (rate > MAX_ANNUAL_RATE) {
    return [{ field, message: "A return above 100% a year is not a realistic assumption" }];
  }
  return [];
}

export function validateMonths(months: number, field = "months"): ValidationIssue[] {
  if (!Number.isFinite(months)) {
    return [{ field, message: "Enter a whole number of months" }];
  }
  if (months < 0) return [{ field, message: "A period cannot be negative" }];
  if (months > MAX_MONTHS) {
    return [{ field, message: "Projections are limited to 100 years" }];
  }
  return [];
}

export function validateAmount(amount: number, field: string, label: string): ValidationIssue[] {
  if (!Number.isFinite(amount)) return [{ field, message: `${label} must be a number` }];
  if (amount < 0) return [{ field, message: `${label} cannot be negative` }];
  if (amount > 1e12) return [{ field, message: `${label} is unrealistically large` }];
  return [];
}

/**
 * Convert an annual rate to its effective monthly equivalent.
 * See assumption 2 above for why this is not `annual / 12`.
 */
export function monthlyRate(annualRate: number): number {
  assert(validateRate(annualRate));
  if (annualRate === 0) return 0;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** Future value of a single amount left to grow. */
export function futureValueLumpSum(
  presentValue: number,
  annualRate: number,
  months: number,
): number {
  assert([
    ...validateAmount(presentValue, "presentValue", "Lump sum"),
    ...validateRate(annualRate),
    ...validateMonths(months),
  ]);

  if (months === 0) return presentValue;
  return presentValue * Math.pow(1 + monthlyRate(annualRate), months);
}

/**
 * Future value of a regular monthly payment (ordinary annuity, paid at
 * month end).
 */
export function futureValueMonthly(
  payment: number,
  annualRate: number,
  months: number,
): number {
  assert([
    ...validateAmount(payment, "payment", "Monthly contribution"),
    ...validateRate(annualRate),
    ...validateMonths(months),
  ]);

  if (months === 0 || payment === 0) return 0;

  const i = monthlyRate(annualRate);
  // Separate path: the formula below divides by i.
  if (i === 0) return payment * months;

  return payment * ((Math.pow(1 + i, months) - 1) / i);
}

export type ProjectionYear = {
  year: number;
  contributed: number;
  value: number;
  growth: number;
};

export type ProjectionResult = {
  months: number;
  annualRate: number;
  totalContributed: number;
  futureValue: number;
  growth: number;
  /** Year-by-year, for the chart and table. Index 0 is "today". */
  series: ProjectionYear[];
};

/**
 * The core projection: a lump sum, a monthly contribution, or both.
 *
 * The year-by-year series is built by stepping month by month rather than by
 * applying an annual formula, so it agrees exactly with the headline figure
 * instead of drifting away from it.
 */
export function project(input: {
  initialAmount: number;
  monthlyContribution: number;
  annualRate: number;
  months: number;
}): ProjectionResult {
  const { initialAmount, monthlyContribution, annualRate, months } = input;

  assert([
    ...validateAmount(initialAmount, "initialAmount", "Starting amount"),
    ...validateAmount(monthlyContribution, "monthlyContribution", "Monthly contribution"),
    ...validateRate(annualRate, "annualRate"),
    ...validateMonths(months, "months"),
  ]);

  const i = monthlyRate(annualRate);
  const series: ProjectionYear[] = [
    { year: 0, contributed: roundMoney(initialAmount), value: roundMoney(initialAmount), growth: 0 },
  ];

  let value = initialAmount;
  let contributed = initialAmount;

  for (let month = 1; month <= months; month += 1) {
    // Growth first, then the contribution: the payment arrives at month end
    // and so earns nothing in the month it is made.
    value = value * (1 + i) + monthlyContribution;
    contributed += monthlyContribution;

    if (month % 12 === 0 || month === months) {
      series.push({
        year: month / 12,
        contributed: roundMoney(contributed),
        value: roundMoney(value),
        growth: roundMoney(value - contributed),
      });
    }
  }

  return {
    months,
    annualRate,
    totalContributed: roundMoney(contributed),
    futureValue: roundMoney(value),
    growth: roundMoney(value - contributed),
    series,
  };
}

/**
 * The monthly contribution needed to reach a target.
 *
 * Solves the future-value annuity formula for the payment, after allowing for
 * whatever the starting amount will have grown to on its own.
 *
 * Returns 0 — not a negative number — when the starting amount already gets
 * there. "You need to save nothing further" is the honest answer; a negative
 * required contribution is meaningless.
 */
export function requiredMonthlyContribution(input: {
  target: number;
  initialAmount: number;
  annualRate: number;
  months: number;
}): { requiredMonthly: number; alreadySufficient: boolean; shortfall: number } {
  const { target, initialAmount, annualRate, months } = input;

  assert([
    ...validateAmount(target, "target", "Target amount"),
    ...validateAmount(initialAmount, "initialAmount", "Starting amount"),
    ...validateRate(annualRate, "annualRate"),
    ...validateMonths(months, "months"),
    ...(months === 0
      ? [{ field: "months", message: "Choose a target date in the future" }]
      : []),
  ]);

  const grownInitial = futureValueLumpSum(initialAmount, annualRate, months);
  const shortfall = target - grownInitial;

  if (shortfall <= 0) {
    return { requiredMonthly: 0, alreadySufficient: true, shortfall: 0 };
  }

  const i = monthlyRate(annualRate);
  const required =
    i === 0 ? shortfall / months : (shortfall * i) / (Math.pow(1 + i, months) - 1);

  return {
    requiredMonthly: roundMoney(required),
    alreadySufficient: false,
    shortfall: roundMoney(shortfall),
  };
}

/**
 * The lump sum needed today to reach a target, given any planned monthly
 * contributions.
 */
export function requiredLumpSum(input: {
  target: number;
  monthlyContribution: number;
  annualRate: number;
  months: number;
}): { requiredLumpSum: number; alreadySufficient: boolean } {
  const { target, monthlyContribution, annualRate, months } = input;

  assert([
    ...validateAmount(target, "target", "Target amount"),
    ...validateAmount(monthlyContribution, "monthlyContribution", "Monthly contribution"),
    ...validateRate(annualRate, "annualRate"),
    ...validateMonths(months, "months"),
    ...(months === 0
      ? [{ field: "months", message: "Choose a target date in the future" }]
      : []),
  ]);

  const fromContributions = futureValueMonthly(monthlyContribution, annualRate, months);
  const shortfall = target - fromContributions;

  if (shortfall <= 0) {
    return { requiredLumpSum: 0, alreadySufficient: true };
  }

  const required = shortfall / Math.pow(1 + monthlyRate(annualRate), months);
  return { requiredLumpSum: roundMoney(required), alreadySufficient: false };
}

/**
 * The capital needed to produce a target income at an assumed distribution
 * yield.
 *
 * Deliberately simple: annual income ÷ yield. It assumes the capital is never
 * drawn down and the yield holds — both of which the UI states plainly.
 */
export function capitalForIncome(input: {
  monthlyIncome: number;
  annualYield: number;
}): number {
  const { monthlyIncome, annualYield } = input;

  assert([
    ...validateAmount(monthlyIncome, "monthlyIncome", "Monthly income"),
    ...(!Number.isFinite(annualYield) || annualYield <= 0
      ? [
          {
            field: "annualYield",
            message: "Enter a distribution yield above zero",
          },
        ]
      : []),
    ...(annualYield > 0.5
      ? [{ field: "annualYield", message: "A yield above 50% is not a realistic assumption" }]
      : []),
  ]);

  return roundMoney((monthlyIncome * 12) / annualYield);
}

export type RetirementResult = {
  /** The monthly income the capital sustains for exactly the chosen period. */
  sustainableMonthlyIncome: number;
  /** Whether the requested income lasts the full period. */
  lastsFullPeriod: boolean;
  /** Months until the money runs out, when it does. */
  monthsUntilDepleted: number | null;
  /** What is left at the end, when anything is. */
  remainingCapital: number;
  series: { year: number; balance: number; withdrawn: number }[];
};

/**
 * Retirement drawdown.
 *
 * A transparent amortisation: the capital grows at the assumed rate and a
 * fixed amount is withdrawn each month. Deliberately not Monte Carlo — an
 * advisor can explain this model to a client in one sentence, which matters
 * more here than statistical sophistication.
 */
export function retirementDrawdown(input: {
  capital: number;
  annualRate: number;
  years: number;
  /** Omit to be told what the capital sustains; supply it to test a figure. */
  desiredMonthlyIncome?: number;
}): RetirementResult {
  const { capital, annualRate, years, desiredMonthlyIncome } = input;
  const months = Math.round(years * 12);

  assert([
    ...validateAmount(capital, "capital", "Retirement capital"),
    ...validateRate(annualRate, "annualRate"),
    ...validateMonths(months, "years"),
    ...(months === 0
      ? [{ field: "years", message: "Choose a retirement period of at least one year" }]
      : []),
  ]);

  const i = monthlyRate(annualRate);

  // The payment that draws the balance to exactly zero over the period.
  const sustainable =
    i === 0
      ? capital / months
      : (capital * i) / (1 - Math.pow(1 + i, -months));

  const withdrawal = desiredMonthlyIncome ?? sustainable;

  let balance = capital;
  let withdrawn = 0;
  let depletedAt: number | null = null;
  const series: { year: number; balance: number; withdrawn: number }[] = [
    { year: 0, balance: roundMoney(capital), withdrawn: 0 },
  ];

  for (let month = 1; month <= months; month += 1) {
    balance = balance * (1 + i) - withdrawal;
    withdrawn += withdrawal;

    if (balance <= 0 && depletedAt === null) {
      depletedAt = month;
      balance = 0;
    }

    if (month % 12 === 0 || month === months) {
      series.push({
        year: month / 12,
        balance: roundMoney(Math.max(balance, 0)),
        withdrawn: roundMoney(withdrawn),
      });
    }

    if (depletedAt !== null) break;
  }

  return {
    sustainableMonthlyIncome: roundMoney(sustainable),
    lastsFullPeriod: depletedAt === null,
    monthsUntilDepleted: depletedAt,
    remainingCapital: roundMoney(Math.max(balance, 0)),
    series,
  };
}

export type HajjResult = {
  futureCost: number;
  projectedSavings: number;
  surplus: number;
  requiredMonthly: number;
  onTrack: boolean;
};

/**
 * Hajj goal.
 *
 * Inflates today's estimated cost to the target year, projects existing
 * savings and planned contributions, and reports the gap either way.
 */
export function hajjGoal(input: {
  currentCost: number;
  costInflation: number;
  yearsUntil: number;
  currentSavings: number;
  monthlyContribution: number;
  annualRate: number;
}): HajjResult {
  const {
    currentCost,
    costInflation,
    yearsUntil,
    currentSavings,
    monthlyContribution,
    annualRate,
  } = input;

  const months = Math.round(yearsUntil * 12);

  assert([
    ...validateAmount(currentCost, "currentCost", "Estimated Hajj cost"),
    ...validateAmount(currentSavings, "currentSavings", "Current savings"),
    ...validateAmount(monthlyContribution, "monthlyContribution", "Monthly contribution"),
    ...validateRate(annualRate, "annualRate"),
    ...validateRate(costInflation, "costInflation"),
    ...validateMonths(months, "yearsUntil"),
    ...(months === 0
      ? [{ field: "yearsUntil", message: "Choose a target year in the future" }]
      : []),
  ]);

  const futureCost = currentCost * Math.pow(1 + costInflation, yearsUntil);

  const projectedSavings =
    futureValueLumpSum(currentSavings, annualRate, months) +
    futureValueMonthly(monthlyContribution, annualRate, months);

  const surplus = projectedSavings - futureCost;

  const { requiredMonthly } = requiredMonthlyContribution({
    target: futureCost,
    initialAmount: currentSavings,
    annualRate,
    months,
  });

  return {
    futureCost: roundMoney(futureCost),
    projectedSavings: roundMoney(projectedSavings),
    surplus: roundMoney(surplus),
    requiredMonthly,
    onTrack: surplus >= 0,
  };
}

export type AffordabilityBands = { low: number; medium: number; high: number };

export type AffordabilityResult = {
  surplus: number;
  hasSurplus: boolean;
  low: number;
  medium: number;
  high: number;
};

/**
 * Affordable starting point.
 *
 * Monthly surplus is income minus expenses, and the illustrative range is a
 * set proportion of that surplus. It is not a suitability assessment, and the
 * UI says so beside every result.
 *
 * A zero or negative surplus returns hasSurplus: false rather than a row of
 * zeroes — "you could start with S$0 a month" is not a useful answer, and the
 * screen shows a plain message instead.
 */
export function affordableStartingPoint(input: {
  monthlyIncome: number;
  monthlyExpenses: number;
  bands?: AffordabilityBands;
}): AffordabilityResult {
  const {
    monthlyIncome,
    monthlyExpenses,
    bands = { low: 0.1, medium: 0.2, high: 0.3 },
  } = input;

  assert([
    ...validateAmount(monthlyIncome, "monthlyIncome", "Monthly income"),
    ...validateAmount(monthlyExpenses, "monthlyExpenses", "Monthly expenses"),
  ]);

  const surplus = monthlyIncome - monthlyExpenses;

  if (surplus <= 0) {
    return { surplus: roundMoney(surplus), hasSurplus: false, low: 0, medium: 0, high: 0 };
  }

  return {
    surplus: roundMoney(surplus),
    hasSurplus: true,
    low: roundMoney(surplus * bands.low),
    medium: roundMoney(surplus * bands.medium),
    high: roundMoney(surplus * bands.high),
  };
}

/* ------------------------------------------------------------------ scenarios */

export type ScenarioRates = { conservative: number; moderate: number; growth: number };

export const DEFAULT_SCENARIO_RATES: ScenarioRates = {
  conservative: 0.03,
  moderate: 0.05,
  growth: 0.07,
};

export type ScenarioSet<T> = { conservative: T; moderate: T; growth: T };

/**
 * Run a calculation at all three scenario rates.
 *
 * Every calculator shows three outcomes rather than one number, because a
 * single projection presented alone reads as a prediction.
 */
export function acrossScenarios<T>(
  rates: ScenarioRates,
  compute: (annualRate: number) => T,
): ScenarioSet<T> {
  return {
    conservative: compute(rates.conservative),
    moderate: compute(rates.moderate),
    growth: compute(rates.growth),
  };
}

/* ------------------------------------------------------- portfolio builder */

export type PortfolioItem = { fundId: string; label: string; allocation: number };

export const MIN_PORTFOLIO_FUNDS = 4;
export const MAX_PORTFOLIO_FUNDS = 8;

/**
 * Allocations must total exactly 100%.
 *
 * Compared in basis points to avoid the floating-point trap where three
 * allocations of 33.33% plus one of 0.01% fails an exact === 1 test despite
 * being right. A tenth of a basis point of slack absorbs that without
 * accepting a genuinely wrong total.
 */
export function validateAllocations(items: readonly PortfolioItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (items.length < MIN_PORTFOLIO_FUNDS) {
    issues.push({
      field: "funds",
      message: `Choose at least ${MIN_PORTFOLIO_FUNDS} funds`,
    });
  }
  if (items.length > MAX_PORTFOLIO_FUNDS) {
    issues.push({
      field: "funds",
      message: `Choose no more than ${MAX_PORTFOLIO_FUNDS} funds`,
    });
  }

  for (const item of items) {
    if (!Number.isFinite(item.allocation) || item.allocation < 0) {
      issues.push({
        field: item.fundId,
        message: `${item.label}: allocation cannot be negative`,
      });
    }
  }

  const totalBasisPoints = items.reduce(
    (total, item) => total + Math.round(item.allocation * 10_000),
    0,
  );

  if (items.length > 0 && totalBasisPoints !== 10_000) {
    const percent = (totalBasisPoints / 100).toFixed(2);
    issues.push({
      field: "allocation",
      message: `Allocations total ${percent}%. They must total exactly 100% before this can be calculated.`,
    });
  }

  return issues;
}

/** Split 100% evenly, giving any rounding remainder to the first fund. */
export function equalAllocations(count: number): number[] {
  if (count <= 0) return [];
  const each = Math.floor(10_000 / count);
  const allocations = Array.from({ length: count }, () => each);
  allocations[0] += 10_000 - each * count;
  return allocations.map((bp) => bp / 10_000);
}

/**
 * Weighted historical performance.
 *
 * Returns null unless EVERY selected fund has a figure for the period.
 * Averaging over only the funds that happen to have data would silently
 * change what is being measured, and present it as if it covered the whole
 * portfolio.
 *
 * This is quarantined from the projection on purpose: it is the past, and
 * the UI keeps it in a separate panel for that reason.
 */
export function weightedHistoricalReturn(
  items: readonly { allocation: number; performance: number | null }[],
): number | null {
  if (items.length === 0) return null;
  if (items.some((item) => item.performance === null)) return null;

  return items.reduce(
    (total, item) => total + item.allocation * (item.performance as number),
    0,
  );
}
