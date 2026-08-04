import { describe, expect, it } from "vitest";
import {
  computeHoldingTotals,
  computePortfolioTotals,
  contributionDueDates,
  monthlyContributionOn,
  type HoldingInput,
} from "./holdings";
import { addMonths, defaultNextReviewDate, parseDate, toISODate } from "./dates";
import { sumMoney } from "./money";

const base: HoldingInput = {
  initialLumpSum: 10_000,
  monthlyContribution: 500,
  startDate: "2025-01-15",
  currentValue: 25_000,
  transactions: [],
};

describe("contributionDueDates", () => {
  it("counts the first payment on the start date itself", () => {
    expect(contributionDueDates("2025-01-15", "2025-01-15")).toEqual(["2025-01-15"]);
  });

  it("counts one payment per monthly anniversary", () => {
    expect(contributionDueDates("2025-01-15", "2025-03-15")).toHaveLength(3);
    expect(contributionDueDates("2025-01-15", "2025-03-14")).toHaveLength(2);
  });

  it("clamps month-ends instead of rolling into the next month", () => {
    const dates = contributionDueDates("2025-01-31", "2025-04-30");
    expect(dates).toEqual(["2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30"]);
  });

  it("handles 29 February in a leap year", () => {
    expect(contributionDueDates("2024-01-31", "2024-02-29")).toEqual([
      "2024-01-31",
      "2024-02-29",
    ]);
  });

  it("stops on the date contributions ceased", () => {
    const dates = contributionDueDates("2025-01-15", "2025-12-15", "2025-04-20");
    expect(dates).toEqual(["2025-01-15", "2025-02-15", "2025-03-15", "2025-04-15"]);
  });

  it("returns nothing when the as-of date precedes the start", () => {
    expect(contributionDueDates("2025-06-01", "2025-01-01")).toEqual([]);
  });
});

describe("monthlyContributionOn", () => {
  const withChanges = {
    monthlyContribution: 500,
    transactions: [
      { type: "contribution_change" as const, newMonthlyAmount: 800, effectiveDate: "2025-06-01" },
      { type: "contribution_change" as const, newMonthlyAmount: 0, effectiveDate: "2025-09-01" },
    ],
  };

  it("uses the original amount before any change", () => {
    expect(monthlyContributionOn(withChanges, "2025-05-31")).toBe(500);
  });

  it("applies a change from its effective date", () => {
    expect(monthlyContributionOn(withChanges, "2025-06-01")).toBe(800);
    expect(monthlyContributionOn(withChanges, "2025-08-31")).toBe(800);
  });

  it("supports a change to zero", () => {
    expect(monthlyContributionOn(withChanges, "2025-09-01")).toBe(0);
  });

  it("is not confused by changes recorded out of order", () => {
    const unordered = {
      monthlyContribution: 100,
      transactions: [
        { type: "contribution_change" as const, newMonthlyAmount: 300, effectiveDate: "2025-09-01" },
        { type: "contribution_change" as const, newMonthlyAmount: 200, effectiveDate: "2025-06-01" },
      ],
    };
    expect(monthlyContributionOn(unordered, "2025-07-01")).toBe(200);
    expect(monthlyContributionOn(unordered, "2025-10-01")).toBe(300);
  });
});

describe("computeHoldingTotals — the worked example", () => {
  // 12 payments of 500 from 15 Jan 2025 to 15 Dec 2025, plus a 10,000 start.
  const totals = computeHoldingTotals(base, "2025-12-15");

  it("counts every contribution due", () => {
    expect(totals.contributionsPaid).toBe(12);
    expect(totals.recurringContributed).toBe(6_000);
  });

  it("adds the initial lump sum", () => {
    expect(totals.totalContributed).toBe(16_000);
  });

  it("reports gain in dollars and as a fraction", () => {
    expect(totals.gainLoss).toBe(9_000);
    expect(totals.gainLossFraction).toBeCloseTo(0.5625, 10);
  });
});

describe("computeHoldingTotals — withdrawals and dividends", () => {
  it("adds withdrawals and dividends back before measuring gain", () => {
    const totals = computeHoldingTotals(
      {
        ...base,
        currentValue: 20_000,
        transactions: [
          { type: "withdrawal", amount: 3_000, effectiveDate: "2025-06-01" },
          { type: "dividend", amount: 250, effectiveDate: "2025-07-01" },
          { type: "dividend", amount: 250, effectiveDate: "2025-10-01" },
        ],
      },
      "2025-12-15",
    );

    // Money left the portfolio but was not lost, so it still counts.
    expect(totals.withdrawals).toBe(3_000);
    expect(totals.dividends).toBe(500);
    expect(totals.adjustedValue).toBe(23_500);
    expect(totals.totalContributed).toBe(16_000);
    expect(totals.gainLoss).toBe(7_500);
  });

  it("counts additional lump sums as contributions, not growth", () => {
    const totals = computeHoldingTotals(
      {
        ...base,
        currentValue: 30_000,
        transactions: [
          { type: "additional_lump_sum", amount: 5_000, effectiveDate: "2025-03-01" },
        ],
      },
      "2025-12-15",
    );
    expect(totals.additionalContributed).toBe(5_000);
    expect(totals.totalContributed).toBe(21_000);
    expect(totals.gainLoss).toBe(9_000);
  });

  it("ignores transactions dated after the as-of date", () => {
    const totals = computeHoldingTotals(
      {
        ...base,
        transactions: [
          { type: "dividend", amount: 999, effectiveDate: "2026-01-01" },
        ],
      },
      "2025-12-15",
    );
    expect(totals.dividends).toBe(0);
  });
});

describe("computeHoldingTotals — the dangerous edge cases", () => {
  it("returns null, not 0%, when there are no contributions at all", () => {
    const totals = computeHoldingTotals(
      {
        initialLumpSum: 0,
        monthlyContribution: 0,
        startDate: "2025-01-15",
        currentValue: 1_000,
        transactions: [],
      },
      "2025-12-15",
    );
    expect(totals.totalContributed).toBe(0);
    expect(totals.gainLossFraction).toBeNull();
    // The dollar figure is still meaningful and must not be suppressed.
    expect(totals.gainLoss).toBe(1_000);
  });

  it("never divides by zero", () => {
    const totals = computeHoldingTotals(
      {
        initialLumpSum: 0,
        monthlyContribution: 0,
        startDate: "2025-01-15",
        currentValue: 0,
        transactions: [],
      },
      "2025-12-15",
    );
    expect(Number.isFinite(totals.gainLoss ?? 0)).toBe(true);
    expect(totals.gainLossFraction).toBeNull();
  });

  it("returns null gain/loss when no value has been recorded", () => {
    const totals = computeHoldingTotals({ ...base, currentValue: null }, "2025-12-15");
    // Contributions are still known...
    expect(totals.totalContributed).toBe(16_000);
    // ...but there is no basis for a gain figure, and zero would be a lie.
    expect(totals.adjustedValue).toBeNull();
    expect(totals.gainLoss).toBeNull();
    expect(totals.gainLossFraction).toBeNull();
  });

  it("reports a loss correctly", () => {
    const totals = computeHoldingTotals(
      { ...base, currentValue: 12_000 },
      "2025-12-15",
    );
    expect(totals.gainLoss).toBe(-4_000);
    expect(totals.gainLossFraction).toBeCloseTo(-0.25, 10);
  });

  it("stops accruing once contributions cease", () => {
    const paused = computeHoldingTotals(
      { ...base, contributionsCeasedOn: "2025-04-15" },
      "2025-12-15",
    );
    expect(paused.contributionsPaid).toBe(4);
    expect(paused.recurringContributed).toBe(2_000);
    expect(paused.monthlyContributionNow).toBe(500);
  });

  it("honours an advisor override and flags it", () => {
    const totals = computeHoldingTotals(
      { ...base, contributedOverride: 15_500 },
      "2025-12-15",
    );
    expect(totals.isOverridden).toBe(true);
    expect(totals.totalContributed).toBe(15_500);
    expect(totals.gainLoss).toBe(9_500);
  });

  it("does not drift by cents over many contributions", () => {
    const totals = computeHoldingTotals(
      {
        initialLumpSum: 0,
        monthlyContribution: 33.33,
        startDate: "2020-01-01",
        currentValue: 5_000,
        transactions: [],
      },
      "2029-12-01",
    );
    // 120 payments of 33.33 is exactly 3999.60, not 3999.5999999999995.
    expect(totals.contributionsPaid).toBe(120);
    expect(totals.recurringContributed).toBe(3_999.6);
  });

  it("handles very large values without losing precision", () => {
    const totals = computeHoldingTotals(
      {
        initialLumpSum: 9_999_999.99,
        monthlyContribution: 0,
        startDate: "2025-01-01",
        currentValue: 12_500_000.01,
        transactions: [],
      },
      "2025-12-01",
    );
    expect(totals.totalContributed).toBe(9_999_999.99);
    expect(totals.gainLoss).toBe(2_500_000.02);
  });
});

describe("computePortfolioTotals", () => {
  const holdingWith = (status: Parameters<typeof computePortfolioTotals>[0][number]["status"], input: HoldingInput) => ({
    status,
    totals: computeHoldingTotals(input, "2025-12-15"),
  });

  it("excludes closed, matured and lapsed from the headline", () => {
    const portfolio = computePortfolioTotals([
      holdingWith("active", base),
      holdingWith("closed", { ...base, contributionsCeasedOn: "2025-03-15" }),
      holdingWith("matured", { ...base, contributionsCeasedOn: "2025-03-15" }),
      holdingWith("lapsed", { ...base, contributionsCeasedOn: "2025-03-15" }),
    ]);
    expect(portfolio.totalContributed).toBe(16_000);
    expect(portfolio.monthlyContribution).toBe(500);
  });

  it("keeps a paused holding's value but not its monthly contribution", () => {
    const portfolio = computePortfolioTotals([
      holdingWith("active", base),
      holdingWith("paused", { ...base, contributionsCeasedOn: "2025-04-15" }),
    ]);
    expect(portfolio.monthlyContribution).toBe(500);
    expect(portfolio.adjustedValue).toBe(50_000);
    expect(portfolio.totalContributed).toBe(28_000);
  });

  it("flags unvalued holdings rather than treating them as zero", () => {
    const portfolio = computePortfolioTotals([
      holdingWith("active", base),
      holdingWith("active", { ...base, currentValue: null }),
    ]);
    expect(portfolio.unvaluedCount).toBe(1);
    expect(portfolio.adjustedValue).toBe(25_000);
  });

  it("reports null value when nothing is valued at all", () => {
    const portfolio = computePortfolioTotals([
      holdingWith("active", { ...base, currentValue: null }),
    ]);
    expect(portfolio.adjustedValue).toBeNull();
    expect(portfolio.gainLossFraction).toBeNull();
  });

  it("returns zeroed totals for a client with no holdings", () => {
    const portfolio = computePortfolioTotals([]);
    expect(portfolio.totalContributed).toBe(0);
    expect(portfolio.adjustedValue).toBeNull();
    expect(portfolio.unvaluedCount).toBe(0);
  });
});

describe("review date arithmetic", () => {
  it("adds exactly three calendar months", () => {
    expect(defaultNextReviewDate("2026-08-04")).toBe("2026-11-04");
  });

  it("does not roll a month-end into the following month", () => {
    expect(defaultNextReviewDate("2025-11-30")).toBe("2026-02-28");
    expect(defaultNextReviewDate("2025-11-29")).toBe("2026-02-28");
    expect(defaultNextReviewDate("2023-11-30")).toBe("2024-02-29");
  });

  it("crosses a year boundary", () => {
    expect(defaultNextReviewDate("2026-12-15")).toBe("2027-03-15");
  });

  it("keeps addMonths reversible for ordinary dates", () => {
    const start = parseDate("2026-05-10");
    expect(toISODate(addMonths(addMonths(start, 3), -3))).toBe("2026-05-10");
  });
});

describe("money", () => {
  it("sums without floating point drift", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(Array.from({ length: 100 }, () => 0.01))).toBe(1);
  });
});
