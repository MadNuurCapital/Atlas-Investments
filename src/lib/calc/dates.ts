/**
 * Date arithmetic for contribution schedules and review cycles.
 *
 * All dates here are plain calendar dates (`YYYY-MM-DD`), parsed as UTC
 * midnight. Doing so deliberately keeps timezones out of the arithmetic: a
 * contribution paid on the 15th is paid on the 15th, and no daylight-saving
 * rule or server location may shift it.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  if (!DATE_ONLY.test(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${value}`);
    }
    return new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Add whole months, clamping to the end of the target month.
 *
 * 31 January + 1 month is 28 February (or 29 in a leap year), never
 * 3 March. Naive date arithmetic rolls over into the next month, which
 * would quietly shift a client's review date and every contribution
 * anniversary after it.
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string | Date, to: string | Date): number {
  return Math.round(
    (parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000,
  );
}

/**
 * The next quarterly review date: exactly three calendar months on.
 *
 * The advisor may override this at completion, but this is the default and
 * the same rule is used everywhere the app suggests a date.
 */
export function defaultNextReviewDate(reviewDate: string | Date): string {
  return toISODate(addMonths(parseDate(reviewDate), 3));
}
