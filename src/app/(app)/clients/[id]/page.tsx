import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText, Play } from "lucide-react";
import { Card, CardTitle, StatTile, toneFor } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ValueHistoryChart } from "@/components/value-history-chart";
import { getClient, getClientValueHistory } from "@/lib/data/clients";
import {
  formatPercent,
  formatSgDate,
  formatSgd,
  formatSignedSgd,
} from "@/lib/format";

export const metadata: Metadata = { title: "Client overview" };

export default async function ClientOverviewPage({
  params,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const [client, history] = await Promise.all([
    getClient(id),
    getClientValueHistory(id),
  ]);

  if (!client) notFound();

  const { portfolio } = client;

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total contributed"
            value={formatSgd(portfolio.totalContributed)}
          />
          <StatTile label="Current value" value={formatSgd(portfolio.adjustedValue)} />
          <StatTile
            label="Simple gain / loss"
            value={formatSignedSgd(portfolio.gainLoss)}
            sub={
              portfolio.gainLossFraction === null
                ? "No contributions to measure against"
                : formatPercent(portfolio.gainLossFraction, { signed: true })
            }
            tone={toneFor(portfolio.gainLoss)}
          />
          <StatTile
            label="Monthly contribution"
            value={formatSgd(portfolio.monthlyContribution)}
            sub="Active holdings only"
          />
        </div>

        {portfolio.unvaluedCount > 0 && (
          <p className="mt-5 flex items-start gap-2 rounded-md bg-[var(--warning-surface)] p-3 text-sm text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {portfolio.unvaluedCount}{" "}
              {portfolio.unvaluedCount === 1 ? "holding has" : "holdings have"} no
              recorded value, so these totals are incomplete. Record a current
              value on the Investments tab.
            </span>
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Simple gain/loss compares total contributed against current value plus
          withdrawals and dividends. It does not account for the timing of cash
          flows and is not a time-weighted return.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Value history</CardTitle>
          <ValueHistoryChart points={history} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>Next steps</CardTitle>
            <div className="space-y-2">
              <Link
                href={`/reviews/start/${client.id}`}
                className={`${buttonVariants()} w-full`}
              >
                <Play className="size-4" />
                Start review
              </Link>
              <Link
                href={`/clients/${client.id}/reports`}
                className={`${buttonVariants({ variant: "secondary" })} w-full`}
              >
                <FileText className="size-4" />
                Client snapshot
              </Link>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Next review</dt>
                <dd className="font-medium text-foreground">
                  {formatSgDate(client.next_review_date)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Holdings</dt>
                <dd className="font-medium text-foreground">
                  {client.holdings.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Dividends recorded</dt>
                <dd className="tabular font-medium text-foreground">
                  {formatSgd(portfolio.dividends)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardTitle>Internal notes</CardTitle>
            {client.notes ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {client.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes recorded.</p>
            )}
            <p className="mt-3 text-xs text-subtle-foreground">
              Private to you. Never appears on a client snapshot or PDF.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
