import { z } from "zod";

/**
 * Shared input validation.
 *
 * Everything a user types arrives as a string. These schemas turn it into
 * trustworthy values and reject the rest with a message an advisor can act
 * on — never a raw database error.
 */

/**
 * Money from a form field.
 *
 * Accepts "1,234.50", "S$1234.5" and "1234". Rejects negatives, because no
 * field in this application legitimately takes negative money: a withdrawal
 * is a positive amount of a withdrawal type, not a negative contribution.
 */
const MAX_MONEY = 999_999_999.99;

/** Strip the currency symbol, thousands separators and stray spaces. */
const cleanMoney = (raw: string) => raw.replace(/[S$,\s]/g, "");

export const moneyField = (label: string, options?: { max?: number }) =>
  z
    .string()
    .trim()
    .transform(cleanMoney)
    .refine((v) => v !== "", `${label} is required`)
    .refine((v) => Number.isFinite(Number(v)), `${label} must be a number`)
    .transform(Number)
    .refine((v) => v >= 0, `${label} cannot be negative`)
    .refine(
      (v) => v <= (options?.max ?? MAX_MONEY),
      `${label} is unrealistically large`,
    );

export const optionalMoneyField = (label: string) =>
  z
    .string()
    .trim()
    .transform(cleanMoney)
    .refine(
      (v) => v === "" || Number.isFinite(Number(v)),
      `${label} must be a number`,
    )
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v >= 0, `${label} cannot be negative`)
    .refine(
      (v) => v === null || v <= MAX_MONEY,
      `${label} is unrealistically large`,
    );

/**
 * A calendar date.
 *
 * The upper bound is deliberate: a start date decades in the future is
 * almost always a typo, and one that silently produces a zero-contribution
 * holding is worse than one that is rejected.
 */
export const dateField = (label: string, options?: { allowFuture?: boolean }) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} must be a valid date`)
    .refine(
      (value) => new Date(value).getUTCFullYear() >= 1900,
      `${label} looks too far in the past`,
    )
    .refine(
      (value) => {
        if (options?.allowFuture) return true;
        const oneYearOut = new Date();
        oneYearOut.setUTCFullYear(oneYearOut.getUTCFullYear() + 1);
        return new Date(value) <= oneYearOut;
      },
      `${label} cannot be more than a year in the future`,
    );

export const optionalDateField = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v),
      `${label} must be a valid date`,
    )
    .refine(
      (v) => v === "" || !Number.isNaN(Date.parse(v)),
      `${label} must be a valid date`,
    )
    .transform((v) => (v === "" ? null : v));

export const requiredText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

/** Turns a Zod failure into one message per field, keyed for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
