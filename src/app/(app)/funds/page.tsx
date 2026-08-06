import type { Metadata } from "next";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataHealthBadge } from "@/components/funds/fund-badges";
import { WatchToggle } from "./watch-toggle";
import { listCategories, listFunds, RISK_LABELS } from "@/lib/data/funds";
import { requireProfile } from "@/lib/auth/dal";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { FundRiskLevel } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Fund Centre" };

export default async function FundsPage({ searchParams }: PageProps<"/funds">) {
  const params = await searchParams;
  const profile = await requireProfile();

  const search = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" ? params.category : "";
  const risk = typeof params.risk === "string" ? (params.risk as FundRiskLevel) : undefined;
  const watchlistOnly = params.watchlist === "1";
  const shariahOnly = params.shariah === "1";

  const [funds, categories] = await Promise.all([
    listFunds({ search, category: category || undefined, risk, watchlistOnly, shariahOnly }),
    listCategories(),
  ]);

  return (
    <>
      <PageHeader
        title="Fund Centre"
        description="Mutual funds and insurer-linked underlying funds. Latest available NAV, not live prices."
        action={
          profile.role === "admin" ? (
            <Link href="/admin/funds/new" className={buttonVariants()}>
              Add fund
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search name, share class, ISIN or manager"
            aria-label="Search funds"
            className="pl-9"
          />
        </div>

        <Select name="category" defaultValue={category} aria-label="Category" className="w-48">
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>

        <Select name="risk" defaultValue={risk ?? ""} aria-label="Risk level" className="w-44">
          <option value="">Any risk level</option>
          {Object.entries(RISK_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="shariah"
            value="1"
            defaultChecked={shariahOnly}
            className="size-4"
          />
          Shariah only
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="watchlist"
            value="1"
            defaultChecked={watchlistOnly}
            className="size-4"
          />
          My watchlist
        </label>

        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {funds.length === 0 ? (
        <EmptyState
          title={
            watchlistOnly
              ? "Nothing on your watchlist yet"
              : search || category || risk
                ? "No funds match those filters"
                : "No funds in the Fund Centre yet"
          }
          description={
            watchlistOnly
              ? "Star a fund to keep an eye on it here."
              : profile.role === "admin"
                ? "Add funds from a factsheet, or import NAV history in bulk."
                : "An administrator adds funds to the Fund Centre."
          }
          action={
            profile.role === "admin" && !watchlistOnly ? (
              <Link href="/admin/funds/new" className={buttonVariants()}>
                Add the first fund
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-10">
                <Star className="size-4" aria-label="Watchlist" />
              </TH>
              <TH>Fund</TH>
              <TH numeric>Latest NAV</TH>
              <TH numeric>YTD</TH>
              <TH numeric>1M</TH>
              <TH numeric>1Y</TH>
              <TH numeric>3Y</TH>
              <TH numeric>5Y</TH>
              <TH>Data</TH>
            </TR>
          </THead>
          <TBody>
            {funds.map((fund) => (
              <TR key={fund.id}>
                <TD>
                  <WatchToggle fundId={fund.id} isWatched={fund.isWatched} />
                </TD>
                <TD>
                  <Link
                    href={`/funds/${fund.id}`}
                    className="font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                  >
                    {fund.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[fund.share_class, fund.fund_manager, fund.currency]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </TD>
                <TD numeric>{formatCurrency(fund.latest_nav, fund.currency)}</TD>
                <TD numeric>{formatPercent(fund.perf_ytd, { signed: true })}</TD>
                <TD numeric>{formatPercent(fund.perf_1m, { signed: true })}</TD>
                <TD numeric>{formatPercent(fund.perf_1y, { signed: true })}</TD>
                <TD numeric>{formatPercent(fund.perf_3y, { signed: true })}</TD>
                <TD numeric>{formatPercent(fund.perf_5y, { signed: true })}</TD>
                <TD>
                  <DataHealthBadge health={fund.health} navDate={fund.nav_date} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Performance figures are past returns and are never used as a
        projection assumption anywhere in Atlas. A blank cell means the figure
        is not available, not zero.
      </p>
    </>
  );
}
