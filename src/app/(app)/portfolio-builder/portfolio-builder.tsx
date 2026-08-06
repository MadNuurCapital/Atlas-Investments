"use client";

import { useState } from "react";
import { AlertTriangle, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ErrorNotice } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  AssumptionsNote,
  ProjectionChart,
  ScenarioColumns,
} from "@/components/calculators/scenario-results";
import {
  MAX_PORTFOLIO_FUNDS,
  MIN_PORTFOLIO_FUNDS,
  ProjectionError,
  acrossScenarios,
  equalAllocations,
  project,
  validateAllocations,
  weightedHistoricalReturn,
  type ScenarioRates,
} from "@/lib/calc/projections";
import { ILLUSTRATION_DISCLAIMER } from "@/lib/calculators/registry";
import { formatPercent, formatSgd, NOT_AVAILABLE } from "@/lib/format";

export type BuilderFund = {
  id: string;
  name: string;
  shareClass: string;
  currency: string;
  category: string | null;
  perf: { y1: number | null; y3: number | null; y5: number | null };
};

type Selected = { fundId: string; allocation: number };

export function PortfolioBuilder({
  funds,
  clients,
  defaultRates,
}: {
  funds: BuilderFund[];
  clients: { id: string; full_name: string }[];
  defaultRates: ScenarioRates;
}) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [rates, setRates] = useState<ScenarioRates>(defaultRates);
  const [initialAmount, setInitialAmount] = useState(20_000);
  const [monthly, setMonthly] = useState(500);
  const [years, setYears] = useState(10);
  const [distributionMode, setDistributionMode] = useState<"reinvest" | "payout">(
    "reinvest",
  );

  const chosen = selected
    .map((item) => {
      const fund = funds.find((f) => f.id === item.fundId);
      return fund ? { ...item, fund } : null;
    })
    .filter((item): item is Selected & { fund: BuilderFund } => item !== null);

  const issues = validateAllocations(
    chosen.map((item) => ({
      fundId: item.fundId,
      label: item.fund.name,
      allocation: item.allocation,
    })),
  );

  const isValid = issues.length === 0;

  const totalAllocated = chosen.reduce(
    (total, item) => total + Math.round(item.allocation * 10_000),
    0,
  );

  // No useMemo: these are a few dozen multiplications, and the React
  // Compiler memoizes automatically. Hand-written memoization here only
  // stopped it from doing so.
  const projections = computeProjections();

  function computeProjections() {
    if (!isValid) return null;
    try {
      return acrossScenarios(rates, (annualRate) =>
        project({
          initialAmount,
          monthlyContribution: monthly,
          annualRate,
          months: Math.round(years * 12),
        }),
      );
    } catch (cause) {
      if (cause instanceof ProjectionError) return null;
      throw cause;
    }
  }

  // Weighted past performance, quarantined from the projection above.
  const historical =
    chosen.length === 0
      ? null
      : (["y1", "y3", "y5"] as const).map((period) => ({
          period,
          value: weightedHistoricalReturn(
            chosen.map((item) => ({
              allocation: item.allocation,
              performance: item.fund.perf[period],
            })),
          ),
        }));

  function addFund(fundId: string) {
    if (!fundId || selected.some((s) => s.fundId === fundId)) return;
    if (selected.length >= MAX_PORTFOLIO_FUNDS) return;
    setSelected((current) => [...current, { fundId, allocation: 0 }]);
  }

  function spreadEvenly() {
    const shares = equalAllocations(selected.length);
    setSelected((current) =>
      current.map((item, index) => ({ ...item, allocation: shares[index] ?? 0 })),
    );
  }

  if (funds.length === 0) {
    return (
      <EmptyState
        title="No funds available"
        description="An administrator adds funds to the Fund Centre before portfolios can be built."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Funds</CardTitle>
            <Select
              aria-label="Add a fund"
              value=""
              disabled={selected.length >= MAX_PORTFOLIO_FUNDS}
              onChange={(event) => addFund(event.target.value)}
            >
              <option value="">
                {selected.length >= MAX_PORTFOLIO_FUNDS
                  ? `Maximum of ${MAX_PORTFOLIO_FUNDS} funds`
                  : "Add a fund…"}
              </option>
              {funds
                .filter((fund) => !selected.some((s) => s.fundId === fund.id))
                .map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name} — {fund.shareClass}
                  </option>
                ))}
            </Select>

            <p className="mt-2 text-xs text-muted-foreground">
              {selected.length} of {MIN_PORTFOLIO_FUNDS}–{MAX_PORTFOLIO_FUNDS}{" "}
              funds
            </p>

            {chosen.length > 0 && (
              <>
                <div className="mt-4 space-y-3">
                  {chosen.map((item) => (
                    <div key={item.fundId} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.fund.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.fund.shareClass}
                        </p>
                      </div>
                      <div className="relative w-24 shrink-0">
                        <Input
                          inputMode="decimal"
                          aria-label={`Allocation for ${item.fund.name}`}
                          value={Number((item.allocation * 100).toFixed(2))}
                          onChange={(event) => {
                            const percent = Number(event.target.value);
                            setSelected((current) =>
                              current.map((s) =>
                                s.fundId === item.fundId
                                  ? {
                                      ...s,
                                      allocation: Number.isFinite(percent)
                                        ? percent / 100
                                        : 0,
                                    }
                                  : s,
                              ),
                            );
                          }}
                          className="tabular pr-7 text-right"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground">
                          %
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.fund.name}`}
                        className="rounded p-1 text-subtle-foreground hover:bg-surface-sunken hover:text-foreground"
                        onClick={() =>
                          setSelected((current) =>
                            current.filter((s) => s.fundId !== item.fundId),
                          )
                        }
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                  <span
                    className={
                      totalAllocated === 10_000
                        ? "tabular text-sm font-medium text-[var(--positive)]"
                        : "tabular text-sm font-medium text-[var(--warning)]"
                    }
                  >
                    Total {(totalAllocated / 100).toFixed(2)}%
                  </span>
                  <Button variant="secondary" size="sm" onClick={spreadEvenly}>
                    <Scale className="size-4" />
                    Spread evenly
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardTitle>Contributions</CardTitle>
            <div className="space-y-4">
              <Field label="Starting lump sum" htmlFor="initial">
                <MoneyInput
                  id="initial"
                  defaultValue={initialAmount}
                  onChange={(event) =>
                    setInitialAmount(Number(event.target.value.replace(/[^\d.]/g, "")) || 0)
                  }
                />
              </Field>
              <Field label="Monthly contribution" htmlFor="monthly">
                <MoneyInput
                  id="monthly"
                  defaultValue={monthly}
                  onChange={(event) =>
                    setMonthly(Number(event.target.value.replace(/[^\d.]/g, "")) || 0)
                  }
                />
              </Field>
              <Field label="Years" htmlFor="years">
                <Input
                  id="years"
                  inputMode="numeric"
                  defaultValue={years}
                  onChange={(event) => setYears(Number(event.target.value) || 0)}
                />
              </Field>
              <Field
                label="Distributions"
                htmlFor="distribution"
                hint={
                  distributionMode === "reinvest"
                    ? "Distributions are assumed reinvested, so they compound."
                    : "Distributions are assumed paid out, so they do not compound."
                }
              >
                <Select
                  id="distribution"
                  value={distributionMode}
                  onChange={(event) =>
                    setDistributionMode(event.target.value as "reinvest" | "payout")
                  }
                >
                  <option value="reinvest">Reinvested</option>
                  <option value="payout">Paid out</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardTitle>Growth assumptions</CardTitle>
            <p className="mb-4 text-sm text-muted-foreground">
              One assumption for the whole portfolio. Atlas never fills these in
              from the funds&apos; past performance.
            </p>
            <div className="space-y-4">
              {(["conservative", "moderate", "growth"] as const).map((scenario) => (
                <Field
                  key={scenario}
                  label={`${scenario === "growth" ? "Higher growth" : scenario.charAt(0).toUpperCase() + scenario.slice(1)} (% a year)`}
                  htmlFor={`rate-${scenario}`}
                >
                  <Input
                    id={`rate-${scenario}`}
                    inputMode="decimal"
                    defaultValue={Number((rates[scenario] * 100).toFixed(2))}
                    onChange={(event) =>
                      setRates((current) => ({
                        ...current,
                        [scenario]: (Number(event.target.value) || 0) / 100,
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {!isValid ? (
            <Card>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Not ready to calculate
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {issues.map((issue) => (
                      <li key={issue.message}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ) : projections ? (
            <>
              <ScenarioColumns
                results={projections}
                rates={rates}
                valueLabel={
                  distributionMode === "reinvest"
                    ? "Projected value, distributions reinvested"
                    : "Projected value, distributions paid out"
                }
              />

              <Card>
                <CardTitle>Allocation</CardTitle>
                <div className="mb-4 flex h-3 overflow-hidden rounded-full">
                  {chosen.map((item, index) => (
                    <div
                      key={item.fundId}
                      title={`${item.fund.name}: ${formatPercent(item.allocation)}`}
                      style={{
                        width: `${item.allocation * 100}%`,
                        opacity: 1 - index * 0.1,
                      }}
                      className="bg-[var(--brand-500)] dark:bg-[var(--brand-400)]"
                    />
                  ))}
                </div>
                <Table>
                  <THead>
                    <TR>
                      <TH>Fund</TH>
                      <TH>Category</TH>
                      <TH numeric>Allocation</TH>
                      <TH numeric>Of initial</TH>
                      <TH numeric>Of monthly</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {chosen.map((item) => (
                      <TR key={item.fundId}>
                        <TD>
                          <p className="font-medium text-foreground">
                            {item.fund.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.fund.shareClass} · {item.fund.currency}
                          </p>
                        </TD>
                        <TD>{item.fund.category ?? NOT_AVAILABLE}</TD>
                        <TD numeric>{formatPercent(item.allocation)}</TD>
                        <TD numeric>{formatSgd(initialAmount * item.allocation)}</TD>
                        <TD numeric>{formatSgd(monthly * item.allocation)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>

              <Card>
                <CardTitle>Moderate scenario, year by year</CardTitle>
                <ProjectionChart result={projections.moderate} />
              </Card>
            </>
          ) : null}

          {historical && chosen.length >= MIN_PORTFOLIO_FUNDS && (
            <Card className="border-dashed">
              <CardTitle>Historical (past) — weighted by your allocation</CardTitle>
              <p className="mb-4 text-sm text-muted-foreground">
                This panel is deliberately separate from the projection above.
                It describes what these funds did, not what they will do, and it
                does not feed the figures above in any way.
              </p>
              <Table>
                <THead>
                  <TR>
                    <TH>Period</TH>
                    <TH numeric>Weighted past return</TH>
                  </TR>
                </THead>
                <TBody>
                  {historical.map((row) => (
                    <TR key={row.period}>
                      <TD>
                        {row.period === "y1"
                          ? "1 year"
                          : row.period === "y3"
                            ? "3 years"
                            : "5 years"}
                      </TD>
                      <TD numeric>
                        {row.value === null ? (
                          <span className="text-sm font-normal italic text-subtle-foreground">
                            Not available — at least one fund has no figure for
                            this period
                          </span>
                        ) : (
                          formatPercent(row.value, { signed: true })
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}

          <AssumptionsNote />

          <Card>
            <p className="text-sm text-muted-foreground">{ILLUSTRATION_DISCLAIMER}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Atlas does not rank funds or portfolios, and does not label any of
              them as best or recommended.
            </p>
          </Card>

          {clients.length === 0 && (
            <ErrorNotice>
              Add a client before a portfolio can be saved against one.
            </ErrorNotice>
          )}
        </div>
      </div>
    </div>
  );
}
