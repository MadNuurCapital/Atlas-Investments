"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataHealthBadge, ShariahBadge } from "@/components/funds/fund-badges";
import { RISK_LABELS, type DataHealth } from "@/lib/funds/labels";
import { formatCurrency, formatPercent, formatSgDate, NOT_AVAILABLE } from "@/lib/format";
import type { FundRiskLevel } from "@/lib/supabase/types";

export type ComparableFund = {
  id: string;
  name: string;
  shareClass: string;
  manager: string | null;
  currency: string;
  category: string | null;
  riskLevel: FundRiskLevel | null;
  shariahStatus: string;
  distributionType: string;
  distributionFrequency: string;
  latestNav: number | null;
  navDate: string | null;
  health: DataHealth;
  perf: {
    m1: number | null;
    m6: number | null;
    y1: number | null;
    y3: number | null;
    y5: number | null;
    inception: number | null;
  };
};

const MAX_COMPARE = 3;

const PERIODS = [
  ["1 month", "m1"],
  ["6 months", "m6"],
  ["1 year", "y1"],
  ["3 years", "y3"],
  ["5 years", "y5"],
  ["Since inception", "inception"],
] as const;

export function CompareWorkspace({ funds }: { funds: ComparableFund[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const chosen = selected
    .map((id) => funds.find((fund) => fund.id === id))
    .filter((fund): fund is ComparableFund => Boolean(fund));

  const atLimit = chosen.length >= MAX_COMPARE;

  // A comparison across currencies is legitimate for percentages but not for
  // NAV prices, so it is worth saying out loud rather than letting someone
  // read two different currencies as one column of numbers.
  const currencies = new Set(chosen.map((fund) => fund.currency));
  const mixedCurrencies = currencies.size > 1;

  if (funds.length === 0) {
    return (
      <EmptyState
        title="No funds to compare"
        description="An administrator adds funds to the Fund Centre."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Choose funds</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            aria-label="Add a fund to compare"
            className="max-w-md flex-1"
            value=""
            disabled={atLimit}
            onChange={(event) => {
              const id = event.target.value;
              if (id && !selected.includes(id) && !atLimit) {
                setSelected((current) => [...current, id]);
              }
            }}
          >
            <option value="">
              {atLimit
                ? `Maximum of ${MAX_COMPARE} funds reached`
                : "Add a fund…"}
            </option>
            {funds
              .filter((fund) => !selected.includes(fund.id))
              .map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name} — {fund.shareClass}
                </option>
              ))}
          </Select>

          {chosen.length > 0 && (
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear all
            </Button>
          )}
        </div>

        {chosen.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chosen.map((fund) => (
              <span
                key={fund.id}
                className="inline-flex items-center gap-2 rounded-full bg-surface-sunken px-3 py-1 text-sm text-foreground"
              >
                {fund.name}
                <button
                  type="button"
                  aria-label={`Remove ${fund.name}`}
                  onClick={() =>
                    setSelected((current) => current.filter((id) => id !== fund.id))
                  }
                  className="rounded-full p-0.5 hover:bg-[var(--border)]"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {chosen.length} of {MAX_COMPARE} selected. Atlas does not rank funds
          or label one as best.
        </p>
      </Card>

      {chosen.length < 2 ? (
        <EmptyState
          title="Choose at least two funds"
          description="A comparison needs something to compare against."
        />
      ) : (
        <>
          {mixedCurrencies && (
            <Card className="border-[var(--warning)] bg-[var(--warning-surface)]">
              <p className="text-sm text-foreground">
                These funds are priced in different currencies (
                {[...currencies].join(", ")}). The percentage returns below are
                each in the fund&apos;s own currency — a return earned in USD
                is not the same as that return in SGD once exchange rates move.
                The NAV row is not comparable at all.
              </p>
            </Card>
          )}

          <Card>
            <CardTitle>Side by side</CardTitle>
            <Table>
              <THead>
                <TR>
                  <TH />
                  {chosen.map((fund) => (
                    <TH key={fund.id}>
                      <span className="block font-semibold normal-case text-foreground">
                        {fund.name}
                      </span>
                      <span className="block font-normal normal-case text-muted-foreground">
                        {fund.shareClass}
                      </span>
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                <Row label="Manager" values={chosen.map((f) => f.manager ?? NOT_AVAILABLE)} />
                <Row label="Category" values={chosen.map((f) => f.category ?? NOT_AVAILABLE)} />
                <Row label="Currency" values={chosen.map((f) => f.currency)} />
                <Row
                  label="Risk level"
                  values={chosen.map((f) =>
                    f.riskLevel ? RISK_LABELS[f.riskLevel] : NOT_AVAILABLE,
                  )}
                />
                <TR>
                  <TD className="font-medium">Shariah status</TD>
                  {chosen.map((fund) => (
                    <TD key={fund.id}>
                      <ShariahBadge status={fund.shariahStatus} />
                    </TD>
                  ))}
                </TR>
                <Row
                  label="Type"
                  values={chosen.map((f) =>
                    f.distributionType === "accumulation" ? "Accumulation" : "Distribution",
                  )}
                />
                <Row
                  label="Distributions"
                  values={chosen.map((f) =>
                    f.distributionFrequency === "none"
                      ? "None"
                      : f.distributionFrequency.replace("_", " "),
                  )}
                />
                <TR>
                  <TD className="font-medium">Latest NAV</TD>
                  {chosen.map((fund) => (
                    <TD key={fund.id} numeric>
                      {formatCurrency(fund.latestNav, fund.currency)}
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatSgDate(fund.navDate)}
                      </p>
                    </TD>
                  ))}
                </TR>
                <TR>
                  <TD className="font-medium">Data</TD>
                  {chosen.map((fund) => (
                    <TD key={fund.id}>
                      <DataHealthBadge health={fund.health} />
                    </TD>
                  ))}
                </TR>
              </TBody>
            </Table>
          </Card>

          <Card>
            <CardTitle>Past performance</CardTitle>
            <Table>
              <THead>
                <TR>
                  <TH>Period</TH>
                  {chosen.map((fund) => (
                    <TH key={fund.id} numeric>
                      {fund.name}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {PERIODS.map(([label, key]) => (
                  <TR key={key}>
                    <TD className="font-medium">{label}</TD>
                    {chosen.map((fund) => (
                      <TD key={fund.id} numeric>
                        {formatPercent(fund.perf[key], { signed: true })}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>

            <p className="mt-3 text-xs text-muted-foreground">
              Past performance only. A blank cell means the figure is not
              available, not zero — often because the fund has not existed
              long enough for that period. Atlas never converts these figures
              into a future-return assumption.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, values }: { label: string; values: string[] }) {
  return (
    <TR>
      <TD className="font-medium">{label}</TD>
      {values.map((value, index) => (
        <TD key={index}>{value}</TD>
      ))}
    </TR>
  );
}
