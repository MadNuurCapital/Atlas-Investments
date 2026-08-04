import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, CheckCircle2, Library, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";
import { listClients } from "@/lib/data/clients";
import { listRecentReviews } from "@/lib/data/reviews";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  bucketByReminder,
} from "@/lib/reviews/reminders";
import { formatSgDate, formatSgd } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS = [
  { href: "/clients/new", label: "Add client", Icon: Plus },
  { href: "/reviews", label: "Complete a review", Icon: CheckCircle2 },
  { href: "/calculators", label: "Open a calculator", Icon: Calculator },
  { href: "/funds", label: "Open Fund Centre", Icon: Library },
] as const;

/**
 * The advisor's own dashboard.
 *
 * Everything here comes from the signed-in advisor's own clients. There are
 * no team-wide or firm-wide figures anywhere, by design.
 */
export default async function DashboardPage() {
  const profile = await requireProfile();
  const [clients, recentReviews] = await Promise.all([
    listClients(),
    listRecentReviews(5),
  ]);

  const buckets = bucketByReminder(clients);
  const firstName = profile.full_name.split(" ")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${formatSgDate(new Date())} · ${clients.length} ${clients.length === 1 ? "client" : "clients"}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKET_ORDER.map((bucket) => {
          const count = buckets[bucket].length;
          const urgent = bucket === "overdue" && count > 0;
          return (
            <Link
              key={bucket}
              href="/reviews"
              className="rounded-lg border border-[var(--border)] bg-surface p-5 transition-colors hover:border-[var(--border-strong)]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                {BUCKET_LABELS[bucket]}
              </p>
              <p
                className={
                  urgent
                    ? "tabular mt-1 text-3xl font-semibold text-[var(--negative)]"
                    : "tabular mt-1 text-3xl font-semibold text-foreground"
                }
              >
                {count}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Needs attention</CardTitle>
          {BUCKET_ORDER.every((bucket) => buckets[bucket].length === 0) ? (
            <EmptyState
              title={clients.length === 0 ? "No clients yet" : "Nothing due"}
              description={
                clients.length === 0
                  ? "Add your first client to start tracking investments and reviews."
                  : "No reviews are due in the next 30 days."
              }
              action={
                clients.length === 0 ? (
                  <Link href="/clients/new" className={buttonVariants()}>
                    Add client
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {BUCKET_ORDER.flatMap((bucket) => buckets[bucket])
                .slice(0, 8)
                .map((client) => (
                  <li key={client.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {client.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatSgd(client.portfolio.adjustedValue)} ·{" "}
                        {client.holdingCount}{" "}
                        {client.holdingCount === 1 ? "holding" : "holdings"}
                      </p>
                    </div>
                    <Badge
                      tone={
                        client.reminder.bucket === "overdue"
                          ? "negative"
                          : client.reminder.bucket === "due_30"
                            ? "info"
                            : "warning"
                      }
                    >
                      {client.reminder.label}
                    </Badge>
                    <Link
                      href={`/reviews/start/${client.id}`}
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                    >
                      Review
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>Quick actions</CardTitle>
            <div className="space-y-2">
              {QUICK_ACTIONS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${buttonVariants({ variant: "secondary" })} w-full justify-start`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Recently reviewed</CardTitle>
            {recentReviews.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                No completed reviews yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recentReviews.map((review) => (
                  <li key={review.id} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/reviews/${review.id}`}
                      className="truncate text-sm text-foreground hover:underline"
                    >
                      {(review.clients as { full_name?: string } | null)?.full_name ??
                        "Client"}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatSgDate(review.review_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
