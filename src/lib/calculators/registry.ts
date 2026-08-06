import type { CalculatorType } from "@/lib/supabase/types";

/**
 * The seven calculators.
 *
 * One registry so the index page, the routes and the saved-plans list all
 * agree on names and descriptions, and adding an eighth means editing one
 * place rather than four.
 */

export type CalculatorMeta = {
  slug: string;
  type: CalculatorType;
  name: string;
  summary: string;
  question: string;
};

export const CALCULATORS: CalculatorMeta[] = [
  {
    slug: "projection",
    type: "projection",
    name: "Investment Projection",
    summary: "Project a lump sum, a monthly contribution, or both.",
    question: "What might this grow to?",
  },
  {
    slug: "target-contribution",
    type: "target_contribution",
    name: "Target Monthly Contribution",
    summary: "The monthly amount needed to reach a target by a chosen date.",
    question: "How much a month do I need to save?",
  },
  {
    slug: "required-lump-sum",
    type: "required_lump_sum",
    name: "Required Lump Sum",
    summary: "The amount needed today to reach a future target.",
    question: "How much do I need to start with?",
  },
  {
    slug: "retirement",
    type: "retirement",
    name: "Retirement Income",
    summary: "Drawdown over a chosen period, or income from distributions.",
    question: "What income will my capital support?",
  },
  {
    slug: "dividend-income",
    type: "dividend_income",
    name: "Dividend / Distribution Income",
    summary: "The capital needed for a target monthly income at an assumed yield.",
    question: "What capital produces this income?",
  },
  {
    slug: "hajj",
    type: "hajj",
    name: "Hajj Goal",
    summary: "Future Hajj cost after inflation, and the contribution to reach it.",
    question: "Am I on track for Hajj?",
  },
  {
    slug: "affordability",
    type: "affordability",
    name: "Affordable Starting Point",
    summary: "An illustrative starting range from monthly income and expenses.",
    question: "What could I realistically start with?",
  },
];

export function findCalculator(slug: string): CalculatorMeta | undefined {
  return CALCULATORS.find((calculator) => calculator.slug === slug);
}

export const CALCULATOR_NAMES: Record<CalculatorType, string> = Object.fromEntries(
  CALCULATORS.map((calculator) => [calculator.type, calculator.name]),
) as Record<CalculatorType, string>;

/**
 * The disclaimer that appears beside every calculator result.
 *
 * Deliberately one shared constant. Wording that matters this much should
 * not drift between screens.
 */
export const ILLUSTRATION_DISCLAIMER =
  "These figures are illustrative projections based on the assumptions shown, " +
  "not a guarantee or a prediction. Actual returns will vary and may be " +
  "negative. This is not a personal recommendation.";

export const AFFORDABILITY_DISCLAIMER =
  "This is an illustrative starting range based only on the income and " +
  "expenses entered. It is not a suitability assessment, financial advice, " +
  "or a recommendation, and does not consider debts, emergency savings, " +
  "insurance or personal circumstances.";
