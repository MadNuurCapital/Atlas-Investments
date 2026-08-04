import type { NavObservation } from "./provider";

/**
 * Parse pasted or uploaded NAV history.
 *
 * Deliberately forgiving about *format* and strict about *values*. An
 * advisor pasting from a factsheet, a provider portal or Excel should not
 * have to reformat anything — but a row that cannot be read with confidence
 * is reported, never guessed at.
 *
 * Accepts comma, tab, semicolon or pipe separators, an optional header row,
 * and dates as YYYY-MM-DD, DD/MM/YYYY or DD-MMM-YYYY.
 *
 * Note on ambiguous dates: 03/04/2026 is read as 3 April, the Singapore
 * convention. A row that would be valid either way is flagged so nobody
 * silently imports American dates.
 */

export type ParsedRow = {
  line: number;
  date: string;
  nav: number;
};

export type RowError = {
  line: number;
  raw: string;
  reason: string;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: RowError[];
  /** Rows dropped because an earlier row already claimed that date. */
  duplicates: number;
  ambiguousDates: number;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

type DateParse = { iso: string; ambiguous: boolean } | null;

export function parseDateCell(raw: string): DateParse {
  const value = raw.trim();
  if (!value) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    return isRealDate(y, m, d)
      ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false }
      : null;
  }

  // DD-MMM-YYYY / DD MMM YYYY
  const named = value.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{4})$/);
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    const year = Number(named[3]);
    if (!month || !isRealDate(year, month, day)) return null;
    return { iso: `${year}-${pad(month)}-${pad(day)}`, ambiguous: false };
  }

  // DD/MM/YYYY — read the Singapore way.
  const slashed = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (slashed) {
    const day = Number(slashed[1]);
    const month = Number(slashed[2]);
    const year = Number(slashed[3]);
    if (!isRealDate(year, month, day)) return null;
    // Both readings valid, e.g. 03/04 — worth telling the user about.
    const ambiguous = day <= 12 && month <= 12 && day !== month;
    return { iso: `${year}-${pad(month)}-${pad(day)}`, ambiguous };
  }

  return null;
}

export function parseNavCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "").replace(/^S/i, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

const SEPARATOR = /[\t,;|]/;

export function parseNavImport(input: string): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let ambiguousDates = 0;

  const lines = input.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    if (!raw.trim()) continue;

    const cells = raw.split(SEPARATOR).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2) {
      errors.push({ line, raw, reason: "Expected a date and a NAV" });
      continue;
    }

    const parsedDate = parseDateCell(cells[0]);

    // A first row whose date will not parse is almost always a header.
    // Skipping it silently is right; reporting it as an error would make
    // every ordinary paste look broken.
    if (!parsedDate) {
      if (line === 1) continue;
      errors.push({ line, raw, reason: `Could not read "${cells[0]}" as a date` });
      continue;
    }

    const nav = parseNavCell(cells[1]);
    if (nav === null) {
      errors.push({ line, raw, reason: `Could not read "${cells[1]}" as a NAV` });
      continue;
    }

    if (seen.has(parsedDate.iso)) {
      duplicates += 1;
      continue;
    }

    seen.add(parsedDate.iso);
    if (parsedDate.ambiguous) ambiguousDates += 1;
    rows.push({ line, date: parsedDate.iso, nav });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return { rows, errors, duplicates, ambiguousDates };
}

/**
 * Percentage change between two NAVs, as a decimal fraction.
 * Returns null rather than Infinity or 0 when it cannot be computed.
 */
export function navReturn(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;
  return (to - from) / from;
}

/**
 * Performance over a trailing period, computed from stored history.
 *
 * Uses the observation on or immediately before the target date rather than
 * requiring an exact match, because funds do not price every calendar day.
 * If the history does not reach back far enough, the answer is null — the
 * interface then shows "Not available", never 0%.
 */
export function trailingReturn(
  history: readonly NavObservation[],
  months: number,
  asOf?: string,
): number | null {
  if (history.length < 2) return null;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = asOf
    ? [...sorted].reverse().find((point) => point.date <= asOf)
    : sorted.at(-1);
  if (!latest) return null;

  const end = new Date(`${latest.date}T00:00:00Z`);
  const target = new Date(end);
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));

  const targetISO = target.toISOString().slice(0, 10);
  const earliest = sorted[0];

  // Refuse to extrapolate. A "1 year return" from ten months of data would
  // be wrong in a way nobody could see on screen.
  if (earliest.date > targetISO) return null;

  const start = [...sorted].reverse().find((point) => point.date <= targetISO);
  if (!start) return null;

  return navReturn(start.nav, latest.nav);
}
