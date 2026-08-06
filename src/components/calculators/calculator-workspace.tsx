"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ErrorNotice } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  AssumptionsNote,
  ProjectionChart,
  ScenarioColumns,
  SCENARIO_LABELS,
  type Scenario,
} from "./scenario-results";
import {
  ProjectionError,
  acrossScenarios,
  affordableStartingPoint,
  capitalForIncome,
  hajjGoal,
  project,
  requiredLumpSum,
  requiredMonthlyContribution,
  retirementDrawdown,
  type ProjectionResult,
  type ScenarioRates,
} from "@/lib/calc/projections";
import {
  AFFORDABILITY_DISCLAIMER,
  ILLUSTRATION_DISCLAIMER,
  type CalculatorMeta,
} from "@/lib/calculators/registry";
import { formatPercent, formatSgd } from "@/lib/format";
import { cn } from "@/lib/cn";
import { saveCalculation, type SaveState } from "@/app/(app)/calculators/actions";

type Inputs = Record<string, number>;

const SCENARIOS: Scenario[] = ["conservative", "moderate", "growth"];

function num(value: string): number {
  const cleaned = value.replace(/[S$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" />
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function CalculatorWorkspace({
  calculator,
  clients,
  defaultRates,
  affordabilityBands,
  hajjDefaults,
}: {
  calculator: CalculatorMeta;
  clients: { id: string; full_name: string }[];
  defaultRates: ScenarioRates;
  affordabilityBands: { low: number; medium: number; high: number };
  hajjDefaults: { cost: number; inflation: number };
}) {
  const [rates, setRates] = useState<ScenarioRates>(defaultRates);
  const [inputs, setInputs] = useState<Inputs>(() => initialInputs(calculator.slug, hajjDefaults));
  const [surplusShare, setSurplusShare] = useState(affordabilityBands.medium);
  const [saveState, saveAction] = useActionState<SaveState, FormData>(saveCalculation, {});

  const set = (key: string) => (value: string) =>
    setInputs((current) => ({ ...current, [key]: num(value) }));

  const computed = useMemo(
    () => compute(calculator.slug, inputs, rates, affordabilityBands, surplusShare),
    [calculator.slug, inputs, rates, affordabilityBands, surplusShare],
  );

  const isAffordability = calculator.slug === "affordability";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Your figures</CardTitle>
            <div className="space-y-4">
              {fieldsFor(calculator.slug, hajjDefaults).map((field) => (
                <Field
                  key={field.name}
                  label={field.label}
                  htmlFor={field.name}
                  hint={field.hint}
                >
                  {field.kind === "money" ? (
                    <MoneyInput
                      id={field.name}
                      defaultValue={inputs[field.name] ?? ""}
                      onChange={(event) => set(field.name)(event.target.value)}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      inputMode="decimal"
                      defaultValue={inputs[field.name] ?? ""}
                      onChange={(event) => set(field.name)(event.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
          </Card>

          {isAffordability ? (
            <Card>
              <CardTitle>Share of surplus</CardTitle>
              {/*
               * The filled part of the track is painted from the value.
               * No browser exposes a "progress" pseudo-element on a range
               * input that both engines agree on, so a gradient stop moved
               * to the thumb position is the portable way to show fill.
               */}
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={Math.round(surplusShare * 100)}
                onChange={(event) => setSurplusShare(Number(event.target.value) / 100)}
                className="slider-gold"
                style={{
                  ["--slider-track" as string]: `linear-gradient(90deg, var(--accent-gold) 0%, var(--accent-gold) ${
                    ((surplusShare * 100 - 5) / 55) * 100
                  }%, var(--surface-sunken) ${
                    ((surplusShare * 100 - 5) / 55) * 100
                  }%, var(--surface-sunken) 100%)`,
                }}
                aria-label="Share of monthly surplus"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Currently {Math.round(surplusShare * 100)}% of the monthly
                surplus. The band below shows{" "}
                {Math.round(affordabilityBands.low * 100)}%,{" "}
                {Math.round(affordabilityBands.medium * 100)}% and{" "}
                {Math.round(affordabilityBands.high * 100)}% as well.
              </p>
            </Card>
          ) : (
            <Card>
              <CardTitle>Growth assumptions</CardTitle>
              <p className="mb-4 text-sm text-muted-foreground">
                Adjust these to suit the conversation. Atlas never fills them
                in from a fund&apos;s past performance.
              </p>
              <div className="space-y-4">
                {SCENARIOS.map((scenario) => (
                  <Field
                    key={scenario}
                    label={`${SCENARIO_LABELS[scenario]} (% a year)`}
                    htmlFor={`rate-${scenario}`}
                  >
                    <Input
                      id={`rate-${scenario}`}
                      inputMode="decimal"
                      defaultValue={Number((rates[scenario] * 100).toFixed(2))}
                      onChange={(event) =>
                        setRates((current) => ({
                          ...current,
                          [scenario]: num(event.target.value) / 100,
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {computed.error ? (
            <Card>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Cannot calculate yet
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {computed.error.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ) : (
            <Results
              slug={calculator.slug}
              computed={computed}
              rates={rates}
              bands={affordabilityBands}
              surplusShare={surplusShare}
            />
          )}

          <AssumptionsNote>
            {calculator.slug === "hajj" &&
              " Hajj cost is inflated at the rate entered, separately from investment growth."}
          </AssumptionsNote>

          <Card>
            <p className="text-sm text-muted-foreground">
              {isAffordability ? AFFORDABILITY_DISCLAIMER : ILLUSTRATION_DISCLAIMER}
            </p>
          </Card>

          {!computed.error && (
            <Card>
              <CardTitle>Save this calculation</CardTitle>
              {saveState.savedId ? (
                <p className="flex items-center gap-2 text-sm text-[var(--positive)]" role="status">
                  <Check className="size-4" />
                  Saved. It will reproduce these exact figures and assumptions
                  when reopened.
                </p>
              ) : (
                <form action={saveAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="calculator_type" value={calculator.type} />
                  <input
                    type="hidden"
                    name="payload"
                    value={JSON.stringify({
                      inputs,
                      outputs: computed.saveable,
                      assumptions: {
                        rates,
                        surplusShare: isAffordability ? surplusShare : undefined,
                        contributionTiming: "end of month",
                        rateConversion: "effective monthly",
                        currency: "SGD",
                      },
                    })}
                  />

                  <Field label="Title" htmlFor="title" className="min-w-48 flex-1">
                    <Input
                      id="title"
                      name="title"
                      required
                      defaultValue={`${calculator.name} — ${new Date().toLocaleDateString("en-SG")}`}
                    />
                  </Field>

                  <Field label="Attach to client" htmlFor="client_id" className="w-56">
                    <Select id="client_id" name="client_id" defaultValue="">
                      <option value="">Not attached</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.full_name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <SaveButton />

                  {saveState.error && (
                    <div className="w-full">
                      <ErrorNotice>{saveState.error}</ErrorNotice>
                    </div>
                  )}
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- results */

type Computed = {
  error?: string[];
  projections?: Record<Scenario, ProjectionResult>;
  saveable: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

function Results({
  slug,
  computed,
  rates,
  bands,
  surplusShare,
}: {
  slug: string;
  computed: Computed;
  rates: ScenarioRates;
  bands: { low: number; medium: number; high: number };
  surplusShare: number;
}) {
  if (slug === "affordability") {
    const result = computed.extra as {
      surplus: number;
      hasSurplus: boolean;
      low: number;
      medium: number;
      high: number;
      chosen: number;
    };

    if (!result.hasSurplus) {
      return (
        <EmptyState
          title="No monthly surplus from the figures entered"
          description={`Income minus expenses is ${formatSgd(result.surplus)}. There is no surplus to invest from, so no starting range is shown — a row of zeroes would look like a real answer.`}
        />
      );
    }

    return (
      <Card>
        <CardTitle>Illustrative starting range</CardTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Monthly surplus: <span className="tabular font-medium text-foreground">
            {formatSgd(result.surplus)}
          </span>
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["Lower", result.low, bands.low],
              ["Middle", result.medium, bands.medium],
              ["Upper", result.high, bands.high],
            ] as const
          ).map(([label, value, band]) => (
            <div key={label} className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                {label} · {Math.round(band * 100)}% of surplus
              </p>
              <p className="tabular mt-1 text-2xl font-semibold text-foreground">
                {formatSgd(value)}
              </p>
              <p className="text-xs text-muted-foreground">a month</p>
            </div>
          ))}
        </div>
        {/* The advisor's own choice is the answer they came for, so it is
            the one figure given the headline treatment. The three bands
            above are context for it, not competitors to it. */}
        <div className="mt-5 rounded-[var(--radius)] border border-[var(--accent-gold)]/25 bg-[var(--info-surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
            At the {Math.round(surplusShare * 100)}% you selected
          </p>
          <p className="headline-figure mt-1 text-4xl font-bold">
            {formatSgd(result.chosen)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">a month</p>
        </div>
      </Card>
    );
  }

  if (slug === "dividend-income") {
    const result = computed.extra as { capitalByYield: [number, number][] };
    return (
      <Card>
        <CardTitle>Capital needed</CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Assumed distribution yield</TH>
              <TH numeric>Capital required</TH>
            </TR>
          </THead>
          <TBody>
            {result.capitalByYield.map(([yieldRate, capital]) => (
              <TR key={yieldRate}>
                <TD>{formatPercent(yieldRate)}</TD>
                <TD numeric>{formatSgd(capital)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          Assumes the capital is never drawn down and the yield holds. A
          distribution is not guaranteed and can be reduced or suspended.
        </p>
      </Card>
    );
  }

  if (slug === "retirement") {
    const result = computed.extra as {
      byScenario: Record<Scenario, {
        sustainable: number;
        lastsFullPeriod: boolean;
        monthsUntilDepleted: number | null;
        remainingCapital: number;
      }>;
      testedIncome: number;
    };

    return (
      <Card>
        <CardTitle>Retirement drawdown</CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Scenario</TH>
              <TH numeric>Sustainable monthly income</TH>
              <TH>At the income you entered</TH>
            </TR>
          </THead>
          <TBody>
            {SCENARIOS.map((scenario) => {
              const row = result.byScenario[scenario];
              return (
                <TR key={scenario}>
                  <TD>
                    {SCENARIO_LABELS[scenario]}
                    <p className="text-xs text-muted-foreground">
                      {formatPercent(rates[scenario])} a year
                    </p>
                  </TD>
                  <TD numeric>{formatSgd(row.sustainable)}</TD>
                  <TD>
                    {result.testedIncome <= 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : row.lastsFullPeriod ? (
                      <span className="text-[var(--positive)]">
                        Lasts the full period
                        {row.remainingCapital > 0 &&
                          `, leaving ${formatSgd(row.remainingCapital)}`}
                      </span>
                    ) : (
                      <span className="text-[var(--negative)]">
                        Runs out after{" "}
                        {Math.floor((row.monthsUntilDepleted ?? 0) / 12)} years{" "}
                        {(row.monthsUntilDepleted ?? 0) % 12} months
                      </span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          A transparent drawdown model: the capital grows at the assumed rate
          and a fixed amount is withdrawn each month. It does not model
          sequence-of-returns risk.
        </p>
      </Card>
    );
  }

  if (slug === "hajj") {
    const result = computed.extra as {
      byScenario: Record<Scenario, {
        futureCost: number;
        projectedSavings: number;
        surplus: number;
        requiredMonthly: number;
        onTrack: boolean;
      }>;
    };

    return (
      <Card>
        <CardTitle>Hajj goal</CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Scenario</TH>
              <TH numeric>Future Hajj cost</TH>
              <TH numeric>Projected savings</TH>
              <TH numeric>Surplus / shortfall</TH>
              <TH numeric>Needed monthly</TH>
            </TR>
          </THead>
          <TBody>
            {SCENARIOS.map((scenario) => {
              const row = result.byScenario[scenario];
              return (
                <TR key={scenario}>
                  <TD>{SCENARIO_LABELS[scenario]}</TD>
                  <TD numeric>{formatSgd(row.futureCost)}</TD>
                  <TD numeric>{formatSgd(row.projectedSavings)}</TD>
                  <TD numeric>
                    <span
                      className={
                        row.onTrack ? "text-[var(--positive)]" : "text-[var(--negative)]"
                      }
                    >
                      {formatSgd(row.surplus)}
                    </span>
                  </TD>
                  <TD numeric>{formatSgd(row.requiredMonthly)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    );
  }

  if (slug === "target-contribution" || slug === "required-lump-sum") {
    const result = computed.extra as {
      byScenario: Record<Scenario, { amount: number; alreadySufficient: boolean }>;
      unit: string;
    };

    return (
      <Card>
        <CardTitle>
          {slug === "target-contribution"
            ? "Monthly contribution required"
            : "Lump sum required today"}
        </CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {SCENARIOS.map((scenario) => {
            const row = result.byScenario[scenario];
            return (
              <div
                key={scenario}
                /*
                 * The middle scenario is emphasised, the other two are not.
                 * Three identically-styled figures make the reader choose
                 * which to believe; the central case is the one to discuss,
                 * with the outer two as the range around it.
                 */
                className={cn(
                  "rounded-[var(--radius)] border p-5",
                  scenario === "moderate"
                    ? "border-[var(--accent-gold)]/30 bg-[var(--info-surface)]"
                    : "border-[var(--border)]",
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                  {SCENARIO_LABELS[scenario]}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatPercent(rates[scenario])} a year
                </p>
                {row.alreadySufficient ? (
                  <p className="mt-3 text-sm font-medium text-[var(--positive)]">
                    Already on track — nothing further needed
                  </p>
                ) : (
                  <>
                    <p
                      className={cn(
                        "tabular mt-3 font-semibold",
                        scenario === "moderate"
                          ? "headline-figure text-3xl font-bold"
                          : "text-2xl text-foreground",
                      )}
                    >
                      {formatSgd(row.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{result.unit}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // Plain projection.
  if (!computed.projections) return null;

  return (
    <>
      <ScenarioColumns results={computed.projections} rates={rates} />
      <Card>
        <CardTitle>Moderate scenario, year by year</CardTitle>
        <ProjectionChart result={computed.projections.moderate} />
      </Card>
    </>
  );
}

/* -------------------------------------------------------------- plumbing */

function initialInputs(slug: string, hajj: { cost: number; inflation: number }): Inputs {
  switch (slug) {
    case "projection":
      return { initialAmount: 10_000, monthlyContribution: 500, years: 10 };
    case "target-contribution":
      return { target: 100_000, initialAmount: 10_000, years: 10 };
    case "required-lump-sum":
      return { target: 100_000, monthlyContribution: 0, years: 10 };
    case "retirement":
      return { capital: 500_000, years: 25, desiredMonthlyIncome: 2_500 };
    case "dividend-income":
      return { monthlyIncome: 2_000, annualYield: 4 };
    case "hajj":
      return {
        currentCost: hajj.cost,
        costInflation: hajj.inflation * 100,
        years: 10,
        currentSavings: 5_000,
        monthlyContribution: 200,
      };
    case "affordability":
      return { monthlyIncome: 5_000, monthlyExpenses: 3_500 };
    default:
      return {};
  }
}

type FieldSpec = { name: string; label: string; kind: "money" | "plain"; hint?: string };

function fieldsFor(slug: string, hajj: { cost: number; inflation: number }): FieldSpec[] {
  void hajj;
  switch (slug) {
    case "projection":
      return [
        { name: "initialAmount", label: "Starting lump sum", kind: "money" },
        { name: "monthlyContribution", label: "Monthly contribution", kind: "money" },
        { name: "years", label: "Years", kind: "plain" },
      ];
    case "target-contribution":
      return [
        { name: "target", label: "Target amount", kind: "money" },
        { name: "initialAmount", label: "Already saved", kind: "money" },
        { name: "years", label: "Years until target", kind: "plain" },
      ];
    case "required-lump-sum":
      return [
        { name: "target", label: "Target amount", kind: "money" },
        {
          name: "monthlyContribution",
          label: "Planned monthly contribution",
          kind: "money",
          hint: "Leave at 0 for a lump sum only.",
        },
        { name: "years", label: "Years until target", kind: "plain" },
      ];
    case "retirement":
      return [
        { name: "capital", label: "Retirement capital", kind: "money" },
        { name: "years", label: "Years of retirement", kind: "plain" },
        {
          name: "desiredMonthlyIncome",
          label: "Income you want to test",
          kind: "money",
          hint: "Set to 0 to see only what the capital sustains.",
        },
      ];
    case "dividend-income":
      return [
        { name: "monthlyIncome", label: "Target monthly income", kind: "money" },
        {
          name: "annualYield",
          label: "Assumed distribution yield (% a year)",
          kind: "plain",
          hint: "Sensitivity at three yields is shown alongside.",
        },
      ];
    case "hajj":
      return [
        { name: "currentCost", label: "Hajj cost today", kind: "money" },
        { name: "costInflation", label: "Cost inflation (% a year)", kind: "plain" },
        { name: "years", label: "Years until target", kind: "plain" },
        { name: "currentSavings", label: "Saved so far", kind: "money" },
        { name: "monthlyContribution", label: "Monthly contribution", kind: "money" },
      ];
    case "affordability":
      return [
        { name: "monthlyIncome", label: "Monthly income", kind: "money" },
        { name: "monthlyExpenses", label: "Monthly expenses", kind: "money" },
      ];
    default:
      return [];
  }
}

function compute(
  slug: string,
  inputs: Inputs,
  rates: ScenarioRates,
  bands: { low: number; medium: number; high: number },
  surplusShare: number,
): Computed {
  try {
    const months = Math.round((inputs.years ?? 0) * 12);

    switch (slug) {
      case "projection": {
        const projections = acrossScenarios(rates, (annualRate) =>
          project({
            initialAmount: inputs.initialAmount ?? 0,
            monthlyContribution: inputs.monthlyContribution ?? 0,
            annualRate,
            months,
          }),
        );
        return {
          projections,
          saveable: {
            futureValue: {
              conservative: projections.conservative.futureValue,
              moderate: projections.moderate.futureValue,
              growth: projections.growth.futureValue,
            },
            totalContributed: projections.moderate.totalContributed,
          },
        };
      }

      case "target-contribution": {
        const byScenario = acrossScenarios(rates, (annualRate) => {
          const result = requiredMonthlyContribution({
            target: inputs.target ?? 0,
            initialAmount: inputs.initialAmount ?? 0,
            annualRate,
            months,
          });
          return {
            amount: result.requiredMonthly,
            alreadySufficient: result.alreadySufficient,
          };
        });
        return { extra: { byScenario, unit: "a month" }, saveable: { byScenario } };
      }

      case "required-lump-sum": {
        const byScenario = acrossScenarios(rates, (annualRate) => {
          const result = requiredLumpSum({
            target: inputs.target ?? 0,
            monthlyContribution: inputs.monthlyContribution ?? 0,
            annualRate,
            months,
          });
          return {
            amount: result.requiredLumpSum,
            alreadySufficient: result.alreadySufficient,
          };
        });
        return { extra: { byScenario, unit: "today" }, saveable: { byScenario } };
      }

      case "retirement": {
        const desired = inputs.desiredMonthlyIncome ?? 0;
        const byScenario = acrossScenarios(rates, (annualRate) => {
          const result = retirementDrawdown({
            capital: inputs.capital ?? 0,
            annualRate,
            years: inputs.years ?? 0,
            desiredMonthlyIncome: desired > 0 ? desired : undefined,
          });
          return {
            sustainable: result.sustainableMonthlyIncome,
            lastsFullPeriod: result.lastsFullPeriod,
            monthsUntilDepleted: result.monthsUntilDepleted,
            remainingCapital: result.remainingCapital,
          };
        });
        return {
          extra: { byScenario, testedIncome: desired },
          saveable: { byScenario, testedIncome: desired },
        };
      }

      case "dividend-income": {
        const entered = (inputs.annualYield ?? 0) / 100;
        // Sensitivity at the entered yield plus one either side, so nobody
        // reads a single figure as the answer.
        const yields = [...new Set([entered * 0.75, entered, entered * 1.25])]
          .filter((y) => y > 0)
          .sort((a, b) => a - b);

        const capitalByYield = yields.map(
          (y) =>
            [y, capitalForIncome({ monthlyIncome: inputs.monthlyIncome ?? 0, annualYield: y })] as [
              number,
              number,
            ],
        );
        return { extra: { capitalByYield }, saveable: { capitalByYield } };
      }

      case "hajj": {
        const byScenario = acrossScenarios(rates, (annualRate) =>
          hajjGoal({
            currentCost: inputs.currentCost ?? 0,
            costInflation: (inputs.costInflation ?? 0) / 100,
            yearsUntil: inputs.years ?? 0,
            currentSavings: inputs.currentSavings ?? 0,
            monthlyContribution: inputs.monthlyContribution ?? 0,
            annualRate,
          }),
        );
        return { extra: { byScenario }, saveable: { byScenario } };
      }

      case "affordability": {
        const result = affordableStartingPoint({
          monthlyIncome: inputs.monthlyIncome ?? 0,
          monthlyExpenses: inputs.monthlyExpenses ?? 0,
          bands,
        });
        const chosen = result.hasSurplus ? Math.round(result.surplus * surplusShare * 100) / 100 : 0;
        return { extra: { ...result, chosen }, saveable: { ...result, chosen, surplusShare } };
      }

      default:
        return { error: ["Unknown calculator"], saveable: {} };
    }
  } catch (cause) {
    if (cause instanceof ProjectionError) {
      return { error: cause.issues.map((issue) => issue.message), saveable: {} };
    }
    return { error: ["Check the figures entered."], saveable: {} };
  }
}
