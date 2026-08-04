import { describe, expect, it } from "vitest";
import {
  navReturn,
  parseDateCell,
  parseNavCell,
  parseNavImport,
  trailingReturn,
} from "./nav-import";

describe("parseDateCell", () => {
  it("reads ISO dates", () => {
    expect(parseDateCell("2026-08-04")?.iso).toBe("2026-08-04");
    expect(parseDateCell("2026/8/4")?.iso).toBe("2026-08-04");
  });

  it("reads named months", () => {
    expect(parseDateCell("04-Aug-2026")?.iso).toBe("2026-08-04");
    expect(parseDateCell("4 August 2026")?.iso).toBe("2026-08-04");
  });

  it("reads slashed dates the Singapore way, day first", () => {
    expect(parseDateCell("04/08/2026")?.iso).toBe("2026-08-04");
    // 13 cannot be a month, so this is unambiguous.
    expect(parseDateCell("13/08/2026")?.iso).toBe("2026-08-13");
  });

  it("flags dates that could be read either way", () => {
    expect(parseDateCell("03/04/2026")).toEqual({
      iso: "2026-04-03",
      ambiguous: true,
    });
    expect(parseDateCell("13/04/2026")?.ambiguous).toBe(false);
  });

  it("rejects impossible dates rather than rolling them over", () => {
    expect(parseDateCell("2026-02-30")).toBeNull();
    expect(parseDateCell("32/01/2026")).toBeNull();
    expect(parseDateCell("2026-13-01")).toBeNull();
    expect(parseDateCell("not a date")).toBeNull();
  });

  it("accepts 29 February only in a leap year", () => {
    expect(parseDateCell("2024-02-29")?.iso).toBe("2024-02-29");
    expect(parseDateCell("2026-02-29")).toBeNull();
  });
});

describe("parseNavCell", () => {
  it("strips currency symbols and separators", () => {
    expect(parseNavCell("1,234.5678")).toBe(1234.5678);
    expect(parseNavCell("S$12.34")).toBe(12.34);
    expect(parseNavCell(" 0.9876 ")).toBe(0.9876);
  });

  it("rejects negatives and nonsense", () => {
    expect(parseNavCell("-1.23")).toBeNull();
    expect(parseNavCell("n/a")).toBeNull();
    expect(parseNavCell("")).toBeNull();
  });
});

describe("parseNavImport", () => {
  it("reads a comma-separated paste with a header", () => {
    const result = parseNavImport(`Date,NAV
2026-01-31,1.2345
2026-02-28,1.2500
2026-03-31,1.2100`);

    expect(result.rows).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ date: "2026-01-31", nav: 1.2345 });
  });

  it("reads tab-separated data pasted from a spreadsheet", () => {
    const result = parseNavImport("2026-01-31\t1.2345\n2026-02-28\t1.2500");
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("sorts rows into date order regardless of how they were pasted", () => {
    const result = parseNavImport(`2026-03-31,1.21
2026-01-31,1.23
2026-02-28,1.25`);
    expect(result.rows.map((r) => r.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("reports bad rows instead of guessing, and keeps the good ones", () => {
    const result = parseNavImport(`2026-01-31,1.2345
garbage,1.25
2026-03-31,not-a-number
2026-04-30,1.30`);

    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].line).toBe(2);
    expect(result.errors[1].reason).toContain("NAV");
  });

  it("drops repeated dates and says how many", () => {
    const result = parseNavImport(`2026-01-31,1.23
2026-01-31,1.24`);
    expect(result.rows).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it("counts ambiguous dates so the user can check them", () => {
    const result = parseNavImport("03/04/2026,1.23");
    expect(result.ambiguousDates).toBe(1);
  });

  it("handles an empty paste without complaining", () => {
    const result = parseNavImport("");
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("ignores blank lines in the middle", () => {
    const result = parseNavImport("2026-01-31,1.23\n\n\n2026-02-28,1.25");
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });
});

describe("navReturn", () => {
  it("computes a decimal fraction", () => {
    expect(navReturn(100, 110)).toBeCloseTo(0.1, 10);
    expect(navReturn(100, 90)).toBeCloseTo(-0.1, 10);
  });

  it("returns null rather than dividing by zero", () => {
    expect(navReturn(0, 100)).toBeNull();
    expect(navReturn(-5, 100)).toBeNull();
  });
});

describe("trailingReturn", () => {
  const history = [
    { date: "2025-08-04", nav: 1.0 },
    { date: "2025-11-04", nav: 1.05 },
    { date: "2026-02-04", nav: 1.1 },
    { date: "2026-05-04", nav: 1.15 },
    { date: "2026-08-04", nav: 1.2 },
  ];

  it("computes a trailing period from stored history", () => {
    expect(trailingReturn(history, 12)).toBeCloseTo(0.2, 10);
    expect(trailingReturn(history, 3)).toBeCloseTo(1.2 / 1.15 - 1, 10);
  });

  it("uses the observation on or before the target date", () => {
    // Funds do not price every calendar day, so an exact match is not
    // required — but an earlier price is, never a later one.
    const sparse = [
      { date: "2025-08-01", nav: 1.0 },
      { date: "2026-08-04", nav: 1.5 },
    ];
    expect(trailingReturn(sparse, 12)).toBeCloseTo(0.5, 10);
  });

  it("REFUSES to extrapolate beyond the history it has", () => {
    // Ten months of data cannot answer a one-year question. Returning a
    // number here would be wrong in a way nobody could see on screen.
    const short = [
      { date: "2026-06-04", nav: 1.0 },
      { date: "2026-08-04", nav: 1.1 },
    ];
    expect(trailingReturn(short, 12)).toBeNull();
    expect(trailingReturn(short, 60)).toBeNull();
  });

  it("returns null for too little data rather than zero", () => {
    expect(trailingReturn([], 12)).toBeNull();
    expect(trailingReturn([{ date: "2026-08-04", nav: 1 }], 12)).toBeNull();
  });
});
