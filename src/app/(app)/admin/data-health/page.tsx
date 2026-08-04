import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, Badge, EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataHealthBadge } from "@/components/funds/fund-badges";
import { RefreshNowButton } from "./refresh-button";
import {
  HEALTH_LABELS,
  listFunds,
  listRefreshRuns,
  type DataHealth,
} from "@/lib/data/funds";
import { formatSgDate, formatSgDateTime, NOT_AVAILABLE } from "@/lib/format";

export const metadata: Metadata = { title: "Data Health" };

const ORDER: DataHealth[] = ["failed", "stale", "missing", "manual", "current"];

export default async function DataHealthPage() {
  const [funds, runs] = await Promise.all([
    listFunds({ includeArchived: false }),
    listRefreshRuns(10),
  ]);

  const counts = ORDER.reduce<Record<DataHealth, number>>(
    (acc, health) => {
      acc[health] = funds.filter((f) => f.health === health).length;
      return acc;
    },
    { current: 0, stale: 0, failed: 0, missing: 0, manual: 0 },
  );

  const needsAttention = funds.filter(
    (fund) => fund.health === "failed" || fund.health === "stale" || fund.health === "missing",
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ORDER.map((health) => (
          <Card key={health} className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
              {HEALTH_LABELS[health]}
            </p>
            <p
              className={
                (health === "failed" || health === "missing") && counts[health] > 0
                  ? "tabular mt-1 text-2xl font-semibold text-[var(--negative)]"
                  : health === "stale" && counts[health] > 0
                    ? "tabular mt-1 text-2xl font-semibold text-[var(--warning)]"
                    : "tabular mt-1 text-2xl font-semibold text-foreground"
              }
            >
              {counts[health]}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manually managed funds are not listed here — they are working as
              intended, not broken.
            </p>
          </div>
          <RefreshNowButton />
        </div>

        {needsAttention.length === 0 ? (
          <EmptyState
            title="Everything is current"
            description="No fund has a failed refresh, a stale NAV or a missing value."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Fund</TH>
                <TH>State</TH>
                <TH>NAV date</TH>
                <TH>Reason</TH>
              </TR>
            </THead>
            <TBody>
              {needsAttention.map((fund) => (
                <TR key={fund.id}>
                  <TD>
                    <Link
                      href={`/admin/funds/${fund.id}`}
                      className="font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                    >
                      {fund.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{fund.share_class}</p>
                  </TD>
                  <TD>
                    <DataHealthBadge health={fund.health} />
                  </TD>
                  <TD>{formatSgDate(fund.nav_date)}</TD>
                  <TD>
                    <span className="text-sm text-muted-foreground">
                      {fund.last_refresh_error ??
                        (fund.health === "missing"
                          ? "No NAV has been recorded"
                          : "NAV is older than the staleness threshold")}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardTitle>Refresh log</CardTitle>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No refresh has run yet. The scheduled job runs daily at 05:00
            Singapore time; you can also run one now with the button above.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Started</TH>
                <TH>Result</TH>
                <TH numeric>Attempted</TH>
                <TH numeric>Succeeded</TH>
                <TH numeric>Failed</TH>
                <TH>Triggered by</TH>
              </TR>
            </THead>
            <TBody>
              {runs.map((run) => (
                <TR key={run.id}>
                  <TD>{formatSgDateTime(run.started_at)}</TD>
                  <TD>
                    {run.status === null ? (
                      <Badge tone="neutral">Running</Badge>
                    ) : run.status === "success" ? (
                      <Badge tone="positive">Success</Badge>
                    ) : run.status === "partial" ? (
                      <Badge tone="warning">Partial</Badge>
                    ) : (
                      <Badge tone="negative">Failed</Badge>
                    )}
                  </TD>
                  <TD numeric>{run.funds_attempted}</TD>
                  <TD numeric>{run.funds_succeeded}</TD>
                  <TD numeric>{run.funds_failed}</TD>
                  <TD>{run.triggered_by || NOT_AVAILABLE}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          A failed refresh never deletes data. The fund keeps its full history
          and its last good NAV, and is flagged here with the reason.
        </p>
      </Card>
    </div>
  );
}
