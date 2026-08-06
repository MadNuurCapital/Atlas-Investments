import { describe, expect, it } from "vitest";
import {
  ProjectionError,
  acrossScenarios,
  affordableStartingPoint,
  capitalForIncome,
  equalAllocations,
  futureValueLumpSum,
  futureValueMonthly,
  hajjGoal,
  monthlyRate,
  project,
  requiredLumpSum,
  requiredMonthlyContribution,
  retirementDrawdown,
  validateAllocations,
  weightedHistoricalReturn,
  DEFAULT_SCENARIO_RATES,
} from "./projections";

describe("monthlyRate", () => {
  it("uses effective compounding, not annual ÷ 12", () => {
    const rate = monthlyRate(0.05);
    expect(rate).toBeCloseTo(0.004074, 6);
    // The nominal shortcut would give 0.0041667 and quietly overstate growth.
    expect(rate).toBeLessThan(0.05 / 12);
  });

  it("compounds back to exactly the annual rate over twelve months", () => {
    expect(Math.pow(1 + monthlyRate(0.07), 12) - 1).toBeCloseTo(0.07, 12);
  });

  it("returns zero for a zero rate", () => {
    expect(monthlyRate(0)).toBe(0);
  });

  it("handles a negative return", () => {
    expect(monthlyRate(-0.1)).toBeLessThan(0);
  });

  it("refuses an absurd rate rather than producing a number", () => {
    expect(() => monthlyRate(5)).toThrow(ProjectionError);
    expect(() => monthlyRate(Number.NaN)).toThrow(ProjectionError);
  });
});

describe("futureValueLumpSum", () => {
  it("matches a known compound-interest answer", () => {
    // 10,000 at 5% effective for 10 years = 10,000 × 1.05^10 = 16,288.95
    expect(futureValueLumpSum(10_000, 0.05, 120)).toBeCloseTo(16_288.95, 2);
  });

  it("returns the input unchanged over zero months", () => {
    expect(futureValueLumpSum(10_000, 0.05, 0)).toBe(10_000);
  });

  it("returns the input unchanged at a zero rate", () => {
    expect(futureValueLumpSum(10_000, 0, 120)).toBe(10_000);
  });

  it("shrinks with a negative return", () => {
    expect(futureValueLumpSum(10_000, -0.05, 120)).toBeCloseTo(5_987.37, 2);
  });
});

describe("futureValueMonthly", () => {
  it("matches a known annuity answer", () => {
    // 500/month for 10 years at 5% EFFECTIVE (i = 1.05^(1/12) − 1):
    //   500 × ((1.05^10) − 1) / 0.00407412 = 77,181.58
    //
    // Note this is NOT 77,320.02, which is what the nominal 5%/12
    // convention gives. The £138 gap on a modest ten-year plan is exactly
    // why the effective conversion is used — the nominal shortcut quietly
    // flatters every projection in the product.
    const value = futureValueMonthly(500, 0.05, 120);
    expect(value).toBeGreaterThan(60_000); // more than contributed
    expect(value).toBeCloseTo(77_181.58, 1);
  });

  it("HANDLES A ZERO RATE without dividing by zero", () => {
    // The annuity formula divides by the rate. At 0% the answer must be
    // payment × months, not NaN or Infinity.
    const value = futureValueMonthly(500, 0, 120);
    expect(value).toBe(60_000);
    expect(Number.isFinite(value)).toBe(true);
  });

  it("returns zero for zero months or zero payment", () => {
    expect(futureValueMonthly(500, 0.05, 0)).toBe(0);
    expect(futureValueMonthly(0, 0.05, 120)).toBe(0);
  });
});

describe("project", () => {
  it("combines a lump sum and monthly contributions", () => {
    const result = project({
      initialAmount: 10_000,
      monthlyContribution: 500,
      annualRate: 0.05,
      months: 120,
    });

    // 16,288.95 (lump sum) + 77,181.58 (annuity) = 93,470.53
    expect(result.totalContributed).toBe(70_000);
    expect(result.futureValue).toBeCloseTo(93_470.53, 1);
    expect(result.growth).toBeCloseTo(result.futureValue - 70_000, 2);
  });

  it("agrees exactly with the standalone formulas", () => {
    const result = project({
      initialAmount: 10_000,
      monthlyContribution: 500,
      annualRate: 0.05,
      months: 120,
    });
    const expected =
      futureValueLumpSum(10_000, 0.05, 120) + futureValueMonthly(500, 0.05, 120);

    // The series is stepped month by month; it must not drift from the
    // closed-form answer, or the chart would contradict the headline.
    expect(result.futureValue).toBeCloseTo(expected, 2);
  });

  it("produces a year-by-year series ending at the headline figure", () => {
    const result = project({
      initialAmount: 1_000,
      monthlyContribution: 100,
      annualRate: 0.06,
      months: 60,
    });

    expect(result.series[0]).toEqual({ year: 0, contributed: 1_000, value: 1_000, growth: 0 });
    expect(result.series).toHaveLength(6); // year 0 plus 5 years
    expect(result.series.at(-1)?.value).toBe(result.futureValue);
    expect(result.series.at(-1)?.contributed).toBe(result.totalContributed);
  });

  it("grows nothing at a zero rate but still accumulates contributions", () => {
    const result = project({
      initialAmount: 1_000,
      monthlyContribution: 100,
      annualRate: 0,
      months: 12,
    });
    expect(result.futureValue).toBe(2_200);
    expect(result.growth).toBe(0);
  });

  it("returns the starting amount over zero months", () => {
    const result = project({
      initialAmount: 5_000,
      monthlyContribution: 500,
      annualRate: 0.05,
      months: 0,
    });
    expect(result.futureValue).toBe(5_000);
    expect(result.totalContributed).toBe(5_000);
  });

  it("refuses negative inputs rather than producing a misleading answer", () => {
    expect(() =>
      project({ initialAmount: -100, monthlyContribution: 0, annualRate: 0.05, months: 12 }),
    ).toThrow(ProjectionError);
    expect(() =>
      project({ initialAmount: 0, monthlyContribution: 100, annualRate: 0.05, months: -12 }),
    ).toThrow(ProjectionError);
  });

  it("refuses a period beyond 100 years", () => {
    expect(() =>
      project({ initialAmount: 0, monthlyContribution: 100, annualRate: 0.05, months: 1_500 }),
    ).toThrow(ProjectionError);
  });

  it("handles very large amounts without losing precision", () => {
    const result = project({
      initialAmount: 10_000_000,
      monthlyContribution: 0,
      annualRate: 0.05,
      months: 12,
    });
    expect(result.futureValue).toBeCloseTo(10_500_000, 0);
  });
});

describe("requiredMonthlyContribution", () => {
  it("solves for the payment that reaches the target", () => {
    const { requiredMonthly } = requiredMonthlyContribution({
      target: 100_000,
      initialAmount: 10_000,
      annualRate: 0.05,
      months: 120,
    });

    // Feeding it back through the projection must land on the target.
    const check = project({
      initialAmount: 10_000,
      monthlyContribution: requiredMonthly,
      annualRate: 0.05,
      months: 120,
    });
    expect(check.futureValue).toBeCloseTo(100_000, 0);
  });

  it("works at a zero rate", () => {
    const { requiredMonthly } = requiredMonthlyContribution({
      target: 24_000,
      initialAmount: 0,
      annualRate: 0,
      months: 24,
    });
    expect(requiredMonthly).toBe(1_000);
  });

  it("returns zero, NOT a negative, when the starting amount already gets there", () => {
    const result = requiredMonthlyContribution({
      target: 10_000,
      initialAmount: 50_000,
      annualRate: 0.05,
      months: 120,
    });
    expect(result.alreadySufficient).toBe(true);
    expect(result.requiredMonthly).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  it("refuses a zero period instead of dividing by zero", () => {
    expect(() =>
      requiredMonthlyContribution({
        target: 10_000,
        initialAmount: 0,
        annualRate: 0.05,
        months: 0,
      }),
    ).toThrow(ProjectionError);
  });
});

describe("requiredLumpSum", () => {
  it("solves for the amount needed today", () => {
    const { requiredLumpSum: needed } = requiredLumpSum({
      target: 100_000,
      monthlyContribution: 0,
      annualRate: 0.05,
      months: 120,
    });
    expect(needed).toBeCloseTo(61_391.33, 0);

    const check = project({
      initialAmount: needed,
      monthlyContribution: 0,
      annualRate: 0.05,
      months: 120,
    });
    expect(check.futureValue).toBeCloseTo(100_000, 0);
  });

  it("allows for planned monthly contributions", () => {
    const withContributions = requiredLumpSum({
      target: 100_000,
      monthlyContribution: 300,
      annualRate: 0.05,
      months: 120,
    });
    const without = requiredLumpSum({
      target: 100_000,
      monthlyContribution: 0,
      annualRate: 0.05,
      months: 120,
    });
    expect(withContributions.requiredLumpSum).toBeLessThan(without.requiredLumpSum);
  });

  it("reports zero when contributions alone are enough", () => {
    const result = requiredLumpSum({
      target: 10_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      months: 120,
    });
    expect(result.alreadySufficient).toBe(true);
    expect(result.requiredLumpSum).toBe(0);
  });
});

describe("capitalForIncome", () => {
  it("divides annual income by the yield", () => {
    expect(capitalForIncome({ monthlyIncome: 2_000, annualYield: 0.04 })).toBe(600_000);
  });

  it("REFUSES a zero yield rather than returning Infinity", () => {
    expect(() => capitalForIncome({ monthlyIncome: 2_000, annualYield: 0 })).toThrow(
      ProjectionError,
    );
    expect(() => capitalForIncome({ monthlyIncome: 2_000, annualYield: -0.02 })).toThrow(
      ProjectionError,
    );
  });

  it("refuses an implausible yield", () => {
    expect(() => capitalForIncome({ monthlyIncome: 2_000, annualYield: 0.9 })).toThrow(
      ProjectionError,
    );
  });
});

describe("retirementDrawdown", () => {
  it("finds the income that draws the balance to zero over the period", () => {
    const result = retirementDrawdown({ capital: 1_000_000, annualRate: 0.04, years: 25 });

    expect(result.sustainableMonthlyIncome).toBeGreaterThan(4_000);
    expect(result.lastsFullPeriod).toBe(true);
    // Ending close to zero is the definition of "sustainable for exactly
    // this period".
    expect(result.remainingCapital).toBeLessThan(1);
  });

  it("reports when a requested income runs out early", () => {
    const result = retirementDrawdown({
      capital: 500_000,
      annualRate: 0.03,
      years: 30,
      desiredMonthlyIncome: 5_000,
    });

    expect(result.lastsFullPeriod).toBe(false);
    expect(result.monthsUntilDepleted).toBeGreaterThan(0);
    expect(result.monthsUntilDepleted).toBeLessThan(360);
  });

  it("leaves capital behind when the income is modest", () => {
    const result = retirementDrawdown({
      capital: 1_000_000,
      annualRate: 0.05,
      years: 20,
      desiredMonthlyIncome: 1_000,
    });
    expect(result.lastsFullPeriod).toBe(true);
    expect(result.remainingCapital).toBeGreaterThan(0);
  });

  it("handles a zero rate as simple division", () => {
    const result = retirementDrawdown({ capital: 240_000, annualRate: 0, years: 20 });
    expect(result.sustainableMonthlyIncome).toBe(1_000);
  });

  it("refuses a zero period", () => {
    expect(() =>
      retirementDrawdown({ capital: 100_000, annualRate: 0.04, years: 0 }),
    ).toThrow(ProjectionError);
  });
});

describe("hajjGoal", () => {
  const base = {
    currentCost: 30_000,
    costInflation: 0.05,
    yearsUntil: 10,
    currentSavings: 5_000,
    monthlyContribution: 200,
    annualRate: 0.04,
  };

  it("inflates the cost to the target year", () => {
    const result = hajjGoal(base);
    // 30,000 × 1.05^10 = 48,866.84
    expect(result.futureCost).toBeCloseTo(48_866.84, 0);
  });

  it("reports a shortfall honestly", () => {
    const result = hajjGoal(base);
    expect(result.projectedSavings).toBeLessThan(result.futureCost);
    expect(result.onTrack).toBe(false);
    expect(result.surplus).toBeLessThan(0);
    expect(result.requiredMonthly).toBeGreaterThan(base.monthlyContribution);
  });

  it("reports being on track when contributions are enough", () => {
    const result = hajjGoal({ ...base, monthlyContribution: 400 });
    expect(result.onTrack).toBe(true);
    expect(result.surplus).toBeGreaterThan(0);
  });

  it("the required contribution really does reach the future cost", () => {
    const result = hajjGoal(base);
    const check = project({
      initialAmount: base.currentSavings,
      monthlyContribution: result.requiredMonthly,
      annualRate: base.annualRate,
      months: base.yearsUntil * 12,
    });

    // The required contribution is rounded to the cent — an advisor cannot
    // set up a standing order for 271.4738 a month — so feeding it back
    // lands a shade under the target rather than exactly on it. Over 120
    // months that rounding is worth well under a dollar, and understating
    // is the safe direction.
    const gap = result.futureCost - check.futureValue;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(2);
  });

  it("handles zero inflation", () => {
    const result = hajjGoal({ ...base, costInflation: 0 });
    expect(result.futureCost).toBe(30_000);
  });

  it("refuses a target year that is not in the future", () => {
    expect(() => hajjGoal({ ...base, yearsUntil: 0 })).toThrow(ProjectionError);
  });
});

describe("affordableStartingPoint", () => {
  it("applies the default bands to the surplus", () => {
    const result = affordableStartingPoint({
      monthlyIncome: 5_000,
      monthlyExpenses: 3_500,
    });
    expect(result.surplus).toBe(1_500);
    expect(result.low).toBe(150);
    expect(result.medium).toBe(300);
    expect(result.high).toBe(450);
  });

  it("accepts adjusted bands", () => {
    const result = affordableStartingPoint({
      monthlyIncome: 5_000,
      monthlyExpenses: 3_500,
      bands: { low: 0.05, medium: 0.15, high: 0.25 },
    });
    expect(result.medium).toBe(225);
  });

  it("REFUSES to show a range when there is no surplus", () => {
    // "You could start with S$0 a month" is not a useful answer, and a row
    // of zeroes looks like a real result.
    const noSurplus = affordableStartingPoint({
      monthlyIncome: 3_000,
      monthlyExpenses: 3_000,
    });
    expect(noSurplus.hasSurplus).toBe(false);

    const deficit = affordableStartingPoint({
      monthlyIncome: 3_000,
      monthlyExpenses: 3_500,
    });
    expect(deficit.hasSurplus).toBe(false);
    expect(deficit.surplus).toBe(-500);
  });

  it("refuses negative income or expenses", () => {
    expect(() =>
      affordableStartingPoint({ monthlyIncome: -100, monthlyExpenses: 0 }),
    ).toThrow(ProjectionError);
  });
});

describe("acrossScenarios", () => {
  it("runs the same calculation at all three rates", () => {
    const results = acrossScenarios(DEFAULT_SCENARIO_RATES, (rate) =>
      project({
        initialAmount: 10_000,
        monthlyContribution: 500,
        annualRate: rate,
        months: 120,
      }),
    );

    expect(results.conservative.futureValue).toBeLessThan(results.moderate.futureValue);
    expect(results.moderate.futureValue).toBeLessThan(results.growth.futureValue);
    // Contributions are identical across scenarios; only growth differs.
    expect(results.conservative.totalContributed).toBe(results.growth.totalContributed);
  });
});

describe("validateAllocations", () => {
  const fund = (id: string, allocation: number) => ({
    fundId: id,
    label: `Fund ${id}`,
    allocation,
  });

  it("accepts four funds totalling exactly 100%", () => {
    const issues = validateAllocations([
      fund("a", 0.25),
      fund("b", 0.25),
      fund("c", 0.25),
      fund("d", 0.25),
    ]);
    expect(issues).toEqual([]);
  });

  it("rejects fewer than four funds", () => {
    const issues = validateAllocations([
      fund("a", 0.5),
      fund("b", 0.3),
      fund("c", 0.2),
    ]);
    expect(issues.some((i) => i.message.includes("at least 4"))).toBe(true);
  });

  it("rejects more than eight funds", () => {
    const items = Array.from({ length: 9 }, (_, i) => fund(String(i), 1 / 9));
    const issues = validateAllocations(items);
    expect(issues.some((i) => i.message.includes("no more than 8"))).toBe(true);
  });

  it("rejects a total that is not 100%, and says what it is", () => {
    const issues = validateAllocations([
      fund("a", 0.25),
      fund("b", 0.25),
      fund("c", 0.25),
      fund("d", 0.2),
    ]);
    expect(issues.some((i) => i.message.includes("95.00%"))).toBe(true);
  });

  it("accepts thirds, which exact floating-point equality would reject", () => {
    // 0.3333 × 3 + 0.0001 = 1.0000 in basis points, but 0.9999999… in floats.
    const issues = validateAllocations([
      fund("a", 0.3333),
      fund("b", 0.3333),
      fund("c", 0.3333),
      fund("d", 0.0001),
    ]);
    expect(issues).toEqual([]);
  });

  it("rejects a negative allocation", () => {
    const issues = validateAllocations([
      fund("a", 0.5),
      fund("b", 0.4),
      fund("c", 0.2),
      fund("d", -0.1),
    ]);
    expect(issues.some((i) => i.message.includes("negative"))).toBe(true);
  });
});

describe("equalAllocations", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(equalAllocations(4)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it("still totals exactly 100% when it does not divide cleanly", () => {
    const three = equalAllocations(3);
    const total = three.reduce((sum, a) => sum + Math.round(a * 10_000), 0);
    expect(total).toBe(10_000);

    const seven = equalAllocations(7);
    expect(seven.reduce((sum, a) => sum + Math.round(a * 10_000), 0)).toBe(10_000);
    expect(validateAllocations(
      seven.map((a, i) => ({ fundId: String(i), label: "F", allocation: a })),
    )).toEqual([]);
  });

  it("returns nothing for zero funds", () => {
    expect(equalAllocations(0)).toEqual([]);
  });
});

describe("weightedHistoricalReturn", () => {
  it("weights each fund's past return by its allocation", () => {
    const result = weightedHistoricalReturn([
      { allocation: 0.5, performance: 0.1 },
      { allocation: 0.5, performance: 0.2 },
    ]);
    expect(result).toBeCloseTo(0.15, 10);
  });

  it("REFUSES to answer when any fund is missing that period", () => {
    // Averaging over only the funds with data would quietly change what is
    // being measured while presenting it as the whole portfolio.
    const result = weightedHistoricalReturn([
      { allocation: 0.5, performance: 0.1 },
      { allocation: 0.5, performance: null },
    ]);
    expect(result).toBeNull();
  });

  it("returns null for an empty portfolio", () => {
    expect(weightedHistoricalReturn([])).toBeNull();
  });
});
