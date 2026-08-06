import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { Badge, Card, CardTitle, StatTile } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataHealthBadge, ShariahBadge } from "@/components/funds/fund-badges";
import { NavChart } from "@/components/funds/nav-chart";
import { WatchToggle } from "../watch-toggle";
import { getFund, getLatestRate, RISK_LABELS } from "@/lib/data/funds";
import { requireProfile } from "@/lib/auth/dal";
import {
  formatCurrency,
  formatPercent,
  formatSgDate,
  formatSgd,
  NOT_AVAILABLE,
} from "@/lib/format";

export const metadata: Metadata = { title: "Fund" };

const DISTRIBUTION_LABELS: Record<string, string> = {
  none: "None",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Twice yearly",
  annual: "Yearly",
  irregular: "Irregular",
};

export default async function FundPage({ params }: PageProps<"/funds/[id]">) {
  const { id } = await params;
  const [fund, profile] = await Promise.all([getFund(id), requireProfile()]);
  if (!fund) notFound();

  const rate = await getLatestRate(fund.currency);

  const periods = [
    ["Year to date", fund.perf_ytd],
    ["1 month", fund.perf_1m],
    ["6 months", fund.perf_6m],
    ["1 year", fund.perf_1y],
    ["3 years", fund.perf_3y],
    ["5 years", fund.perf_5y],
    ["Since inception", fund.perf_since_inception],
  ] as const;

  const byKind = (kind: string) => fund.allocations.filter((a) => a.kind === kind);

  return (
    <>
      <Link
        href="/funds"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Fund Centre
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <WatchToggle fundId={fund.id} isWatched={fund.isWatched} />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {fund.name}
            </h1>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {fund.share_class && <span>Share class {fund.share_class}</span>}
            {fund.isin && <span>· ISIN {fund.isin}</span>}
            {fund.fund_manager && <span>· {fund.fund_manager}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ShariahBadge status={fund.shariah_status} />
            {fund.risk_level && (
              <Badge tone="neutral">{RISK_LABELS[fund.risk_level]} risk</Badge>
            )}
            <Badge tone="neutral" className="capitalize">
              {fund.distribution_type}
            </Badge>
            {fund.is_sample && <Badge tone="warning">Sample data</Badge>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <DataHealthBadge health={fund.health} navDate={fund.nav_date} />
          {profile.role === "admin" && (
            <Link
              href={`/admin/funds/${fund.id}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Edit fund
            </Link>
          )}
        </div>
      </div>

      {fund.health === "failed" && fund.last_refresh_error && (
        <Card className="mb-6 border-[var(--negative)] bg-[var(--negative-surface)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--negative)]" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                The last automatic refresh failed
              </p>
              <p className="mt-1 text-muted-foreground">
                {fund.last_refresh_error}
              </p>
              <p className="mt-1 text-muted-foreground">
                The figures below are the last good data, from{" "}
                {formatSgDate(fund.nav_date)}. Nothing has been lost.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Latest available NAV"
            value={formatCurrency(fund.latest_nav, fund.currency)}
            sub={
              fund.nav_date
                ? `as at ${formatSgDate(fund.nav_date)}`
                : "No NAV recorded"
            }
          />
          <StatTile
            label="1 year"
            value={formatPercent(fund.perf_1y, { signed: true })}
            sub="Past performance"
          />
          <StatTile
            label="Distributions"
            value={DISTRIBUTION_LABELS[fund.distribution_frequency] ?? NOT_AVAILABLE}
            sub={fund.distribution_type === "accumulation" ? "Accumulating" : "Paying out"}
          />
          <StatTile
            label="Your clients holding this"
            value={String(fund.ownHoldingCount)}
            sub="Your own clients only"
          />
        </div>

        {rate && fund.latest_nav !== null && (
          <p className="mt-5 rounded-md bg-surface-sunken p-3 text-sm text-muted-foreground">
            Indicative SGD equivalent:{" "}
            <span className="tabular font-medium text-foreground">
              {formatSgd(fund.latest_nav * Number(rate.rate_to_sgd), { decimals: 4 })}
            </span>{" "}
            at {Number(rate.rate_to_sgd).toFixed(4)} as at{" "}
            {formatSgDate(rate.rate_date)}. Shown for scale only — it is never
            used in a client&apos;s portfolio totals or in any calculator.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>NAV history</CardTitle>
          <NavChart points={fund.navHistory} currency={fund.currency} />
        </Card>

        <Card>
          <CardTitle>Past performance</CardTitle>
          <Table>
            <THead>
              <TR>
                <TH>Period</TH>
                <TH numeric>Return</TH>
              </TR>
            </THead>
            <TBody>
              {periods.map(([label, value]) => (
                <TR key={label}>
                  <TD>{label}</TD>
                  <TD numeric>{formatPercent(value, { signed: true })}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Past performance. Atlas never uses these figures as a future-return
            assumption in any calculator or projection.
          </p>
        </Card>
      </div>

      {fund.description && (
        <Card className="mt-6">
          <CardTitle>About this fund</CardTitle>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {fund.description}
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {(["asset_class", "region", "top_holding"] as const).map((kind) => {
          const rows = byKind(kind);
          const title =
            kind === "asset_class"
              ? "Asset allocation"
              : kind === "region"
                ? "Regional allocation"
                : "Top holdings";

          return (
            <Card key={kind}>
              <CardTitle>{title}</CardTitle>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not available.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-foreground">{row.label}</span>
                        <span className="tabular shrink-0 text-muted-foreground">
                          {formatPercent(row.weight, { decimals: 1 })}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full bg-[var(--brand-500)] dark:bg-[var(--brand-400)]"
                          style={{ width: `${Math.min(row.weight * 100, 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardTitle>Data source</CardTitle>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="mt-0.5 font-medium capitalize text-foreground">
              {fund.data_source === "yahoo" ? "Yahoo Finance" : fund.data_source}
              {fund.data_source === "yahoo" && !fund.source_verified && (
                <span className="ml-2 text-xs font-normal text-[var(--warning)]">
                  symbol not verified
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last successful refresh</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {fund.last_refresh_status === "success"
                ? formatSgDate(fund.last_refresh_at)
                : NOT_AVAILABLE}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Factsheet</dt>
            <dd className="mt-0.5">
              {fund.factsheet_url ? (
                <a
                  href={fund.factsheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                >
                  Open factsheet
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <span className="text-muted-foreground">{NOT_AVAILABLE}</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
