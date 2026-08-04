import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { listClients } from "@/lib/data/clients";
import { listRecentReviews } from "@/lib/data/reviews";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  bucketByReminder,
  type ReminderBucket,
} from "@/lib/reviews/reminders";
import { formatSgDate, formatSgd } from "@/lib/format";
import { SnoozeButton } from "./snooze-button";

export const metadata: Metadata = { title: "Reviews" };

const BUCKET_TONE: Record<ReminderBucket, "negative" | "warning" | "info" | "neutral"> = {
  overdue: "negative",
  due_7: "warning",
  due_14: "warning",
  due_30: "info",
  scheduled: "neutral",
  none: "neutral",
};

export default async function ReviewsPage() {
  const [clients, recent] = await Promise.all([listClients(), listRecentReviews(8)]);

  const buckets = bucketByReminder(clients);
  const dueCount = BUCKET_ORDER.reduce((n, b) => n + buckets[b].length, 0);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Every client is reviewed every three months."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {BUCKET_ORDER.map((bucket) => (
          <Card key={bucket} className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
              {BUCKET_LABELS[bucket]}
            </p>
            <p
              className={
                bucket === "overdue" && buckets[bucket].length > 0
                  ? "tabular mt-1 text-2xl font-semibold text-[var(--negative)]"
                  : "tabular mt-1 text-2xl font-semibold text-foreground"
              }
            >
              {buckets[bucket].length}
            </p>
          </Card>
        ))}
      </div>

      {dueCount === 0 ? (
        <EmptyState
          title="Nothing due in the next 30 days"
          description={
            clients.length === 0
              ? "Add clients to start tracking quarterly reviews."
              : "Every client's next review is more than 30 days away."
          }
        />
      ) : (
        <div className="space-y-8">
          {BUCKET_ORDER.filter((bucket) => buckets[bucket].length > 0).map((bucket) => (
            <section key={bucket}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                {BUCKET_LABELS[bucket]}
                <Badge tone={BUCKET_TONE[bucket]}>{buckets[bucket].length}</Badge>
              </h2>

              <Table>
                <THead>
                  <TR>
                    <TH>Client</TH>
                    <TH>Due</TH>
                    <TH numeric>Current value</TH>
                    <TH numeric>Holdings</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {buckets[bucket].map((client) => (
                    <TR key={client.id}>
                      <TD>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                        >
                          {client.full_name}
                        </Link>
                      </TD>
                      <TD>
                        <span className="text-sm">{client.reminder.label}</span>
                        <p className="text-xs text-muted-foreground">
                          {formatSgDate(client.next_review_date)}
                          {client.reminder.isSnoozed && " · snoozed"}
                        </p>
                      </TD>
                      <TD numeric>{formatSgd(client.portfolio.adjustedValue)}</TD>
                      <TD numeric>{client.holdingCount}</TD>
                      <TD>
                        <div className="flex items-center justify-end gap-2">
                          <SnoozeButton clientId={client.id} />
                          <Link
                            href={`/reviews/start/${client.id}`}
                            className={buttonVariants({ size: "sm" })}
                          >
                            Start review
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <Card className="mt-8">
          <CardTitle>Recently completed</CardTitle>
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((review) => (
              <li key={review.id} className="flex items-center gap-3 py-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-[var(--positive)]" />
                <Link
                  href={`/reviews/${review.id}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {(review.clients as { full_name?: string } | null)?.full_name ??
                    "Client"}
                </Link>
                <span className="ml-auto text-sm text-muted-foreground">
                  {formatSgDate(review.review_date)}
                </span>
                {review.correction_count > 0 && <Badge tone="warning">Corrected</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
