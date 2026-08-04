/**
 * Money arithmetic.
 *
 * JavaScript numbers are binary floating point, where 0.1 + 0.2 is
 * 0.30000000000000004. Accumulating dozens of contributions that way drifts
 * by cents, and cents on a client's portfolio statement are indefensible.
 *
 * Every operation here works in integer cents and converts back at the end,
 * so results are exact to the cent regardless of how many terms are summed.
 */

/** Round to whole cents, away from zero on a .005 boundary. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100)) / 100;
}

/** Convert to integer cents. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(value) * 100);
}

/** Convert integer cents back to a currency amount. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Exact sum of money values — adds in cents, so no drift accumulates. */
export function sumMoney(values: readonly number[]): number {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0));
}

/** Exact `count` payments of `amount`. */
export function multiplyMoney(amount: number, count: number): number {
  return fromCents(toCents(amount) * Math.round(count));
}
