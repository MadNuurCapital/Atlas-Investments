import { describe, expect, it } from "vitest";
import {
  NOT_AVAILABLE,
  daysBetweenSg,
  formatPercent,
  formatSgDate,
  formatSgd,
  formatSignedSgd,
} from "./format";

describe("formatSgd", () => {
  it("formats Singapore currency", () => {
    expect(formatSgd(12345.678)).toBe("S$12,345.68");
  });

  it("shows zero as a real zero", () => {
    expect(formatSgd(0)).toBe("S$0.00");
  });

  it("never shows a missing value as zero", () => {
    expect(formatSgd(null)).toBe(NOT_AVAILABLE);
    expect(formatSgd(undefined)).toBe(NOT_AVAILABLE);
    expect(formatSgd(Number.NaN)).toBe(NOT_AVAILABLE);
  });
});

describe("formatPercent", () => {
  it("treats stored values as decimal fractions", () => {
    expect(formatPercent(0.0523)).toBe("5.23%");
  });

  it("distinguishes a true zero from missing data", () => {
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(null)).toBe(NOT_AVAILABLE);
  });

  it("adds an explicit sign when asked", () => {
    expect(formatPercent(0.05, { signed: true })).toBe("+5.00%");
    expect(formatPercent(-0.05, { signed: true })).toBe("-5.00%");
  });
});

describe("formatSignedSgd", () => {
  it("marks gains and losses", () => {
    expect(formatSignedSgd(1234)).toBe("+S$1,234.00");
    expect(formatSignedSgd(-1234)).toBe("−S$1,234.00");
    expect(formatSignedSgd(0)).toBe("S$0.00");
  });
});

describe("formatSgDate", () => {
  it("uses Singapore format", () => {
    expect(formatSgDate("2026-08-04T00:00:00+08:00")).toBe("04 Aug 2026");
  });

  it("rejects unparseable input rather than inventing a date", () => {
    expect(formatSgDate("not a date")).toBe(NOT_AVAILABLE);
    expect(formatSgDate(null)).toBe(NOT_AVAILABLE);
  });
});

describe("daysBetweenSg", () => {
  it("counts whole calendar days", () => {
    expect(daysBetweenSg("2026-08-04T00:00:00+08:00", "2026-11-04T00:00:00+08:00")).toBe(92);
  });

  it("returns 0 on the same Singapore day regardless of time", () => {
    expect(daysBetweenSg("2026-08-04T01:00:00+08:00", "2026-08-04T23:00:00+08:00")).toBe(0);
  });

  it("goes negative once a date is in the past", () => {
    expect(daysBetweenSg("2026-08-04T00:00:00+08:00", "2026-07-28T00:00:00+08:00")).toBe(-7);
  });
});
