"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatPercent, formatSgd } from "@/lib/format";
import type { ProjectionResult } from "@/lib/calc/projections";

export type Scenario = "conservative" | "moderate" | "growth";

export const SCENARIO_LABELS: Record<Scenario, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  growth: "Higher growth",
};

/**
 * Three scenarios side by side.
 *
 * Always three, never one. A single projection shown alone reads as a
 * prediction; three make it obvious that the outcome depends on an
 * assumption the advisor chose.
 *
 * The middle column is not visually emphasised. Highlighting "moderate"
 * would nudge everyone towards it as if it were the recommended answer.
 */
export function ScenarioColumns({
  results,
  rates,
  valueLabel = "Projected value",
  renderValue,
}: {
  results: Record<Scenario, ProjectionResult>;
  rates: Record<Scenario, number>;
  valueLabel?: string;
  renderValue?: (result: ProjectionResult) => string;
}) {
  const scenarios: Scenario[] = ["conservative", "moderate", "growth"];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {scenarios.map((scenario) => {
        const result = results[scenario];
        return (
          <div
            key={scenario}
            className="rounded-lg border border-[var(--border)] bg-surface p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
              {SCENARIO_LABELS[scenario]}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPercent(rates[scenario])} a year assumed
            </p>

            <p className="tabular mt-3 text-2xl font-semibold text-foreground">
              {renderValue ? renderValue(result) : formatSgd(result.futureValue)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{valueLabel}</p>

            <dl className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total contributed</dt>
                <dd className="tabular text-foreground">
                  {formatSgd(result.totalContributed)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Projected growth</dt>
                <dd
                  className={cn(
                    "tabular",
                    result.growth > 0
                      ? "text-[var(--positive)]"
                      : result.growth < 0
                        ? "text-[var(--negative)]"
                        : "text-foreground",
                  )}
                >
                  {formatSgd(result.growth)}
                </dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

/** A growth chart for one scenario's year-by-year series. */
export function ProjectionChart({ result }: { result: ProjectionResult }) {
  const series = result.series;
  if (series.length < 2) return null;

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 72 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(...series.map((point) => point.value), 1);
  const x = (index: number) => padding.left + (index / (series.length - 1)) * plotWidth;
  // Anchored at zero: on a savings projection a truncated axis exaggerates
  // growth, which is exactly the wrong error to make here.
  const y = (value: number) => padding.top + plotHeight - (value / max) * plotHeight;

  const valueLine = series.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const contributedLine = series.map((p, i) => `${x(i)},${y(p.contributed)}`).join(" ");

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img"
        aria-label={`Projected value over ${series.at(-1)?.year} years`}>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const gridY = padding.top + plotHeight - fraction * plotHeight;
          return (
            <g key={fraction}>
              <line x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY}
                stroke="var(--border)" strokeWidth="1" />
              <text x={padding.left - 8} y={gridY + 4} textAnchor="end"
                className="fill-[var(--subtle-foreground)] text-[10px]">
                {formatSgd(max * fraction, { decimals: 0 })}
              </text>
            </g>
          );
        })}

        <polygon
          points={`${padding.left},${padding.top + plotHeight} ${valueLine} ${padding.left + plotWidth},${padding.top + plotHeight}`}
          fill="var(--brand-500)"
          opacity="0.08"
        />
        <polyline points={contributedLine} fill="none" stroke="var(--subtle-foreground)"
          strokeWidth="2" strokeDasharray="4 4" />
        <polyline points={valueLine} fill="none" stroke="var(--brand-500)" strokeWidth="2.5"
          className="dark:stroke-[var(--brand-400)]" />

        {series.map((point, index) =>
          index % Math.max(1, Math.ceil(series.length / 8)) === 0 || index === series.length - 1 ? (
            <text key={point.year} x={x(index)} y={height - 8} textAnchor="middle"
              className="fill-[var(--subtle-foreground)] text-[10px]">
              {point.year}y
            </text>
          ) : null,
        )}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--brand-500)] dark:bg-[var(--brand-400)]" />
          Projected value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[var(--subtle-foreground)]" />
          Total contributed
        </span>
      </figcaption>
    </figure>
  );
}

export function AssumptionsNote({ children }: { children?: React.ReactNode }) {
  return (
    <Card className="bg-surface-sunken">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">Assumptions.</span>{" "}
          Contributions are treated as paid at the end of each month. Annual
          rates convert to monthly by effective compounding, so &ldquo;5% a
          year&rdquo; compounds to exactly 5% over twelve months. Figures are
          in SGD and ignore tax, charges and inflation unless stated.
          {children}
        </span>
      </p>
    </Card>
  );
}
