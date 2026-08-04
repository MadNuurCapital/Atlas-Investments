import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getClient } from "@/lib/data/clients";
import { getPreviousReview, getReview } from "@/lib/data/reviews";
import { defaultNextReviewDate } from "@/lib/calc/dates";
import { formatSgDate, formatSgDateTime } from "@/lib/format";
import { completeReview } from "../actions";
import { ReviewForm, type ReviewHoldingRow } from "./review-form";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage({
  params,
  searchParams,
}: PageProps<"/reviews/[id]">) {
  const { id } = await params;
  const query = await searchParams;

  const review = await getReview(id);
  if (!review) notFound();

  const [client, previous] = await Promise.all([
    getClient(review.client_id, review.review_date),
    getPreviousReview(review.client_id, review.review_date),
  ]);

  if (!client) notFound();

  const isCompleted = review.status === "completed";
  const justCompleted = query.done === "1";

  const previousByHolding = new Map(
    (previous?.review_holding_snapshots ?? []).map((snapshot) => [
      snapshot.holding_id,
      snapshot,
    ]),
  );

  const holdings: ReviewHoldingRow[] = client.holdings.map((holding) => {
    const prior = previousByHolding.get(holding.id);
    return {
      id: holding.id,
      provider: holding.provider,
      productName: holding.product_name,
      fundDisplayName: holding.fundDisplayName,
      status: holding.status,
      currentValue: holding.current_value,
      currentValueAsOf: holding.current_value_as_of,
      totalContributed: holding.totals.totalContributed,
      gainLoss: holding.totals.gainLoss,
      gainLossFraction: holding.totals.gainLossFraction,
      monthlyContribution: holding.totals.monthlyContributionNow,
      previousValue: prior ? Number(prior.current_value) : null,
      previousDate: previous?.review_date ?? null,
    };
  });

  const action = completeReview.bind(null, id, review.client_id, isCompleted);

  return (
    <>
      <Link
        href={`/clients/${client.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to {client.full_name}
      </Link>

      <PageHeader
        title={isCompleted ? "Review" : "Quarterly review"}
        description={`${client.full_name} · ${formatSgDate(review.review_date)}`}
        action={
          isCompleted ? (
            <div className="flex items-center gap-2">
              <Badge tone="positive">Completed</Badge>
              {review.correction_count > 0 && (
                <Badge tone="warning">
                  Corrected {review.correction_count}×
                </Badge>
              )}
            </div>
          ) : (
            <Badge tone="info">In progress</Badge>
          )
        }
      />

      {justCompleted && (
        <Card className="mb-6 border-[var(--positive)] bg-[var(--positive-surface)]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--positive)]" />
            <div>
              <p className="text-sm font-medium text-foreground">Review completed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A snapshot of these figures has been saved and the next review is
                set for {formatSgDate(review.next_review_date)}.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/clients/${client.id}/reports?review=${review.id}`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Open client snapshot
                </Link>
                <Link
                  href="/reviews"
                  className={buttonVariants({ size: "sm", variant: "secondary" })}
                >
                  Back to reviews
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isCompleted && review.corrected_at && (
        <p className="mb-4 text-sm text-muted-foreground">
          Last corrected {formatSgDateTime(review.corrected_at)}.
        </p>
      )}

      <ReviewForm
        action={action}
        holdings={holdings}
        isCorrection={isCompleted}
        previousNotes={previous?.discussion_notes ?? null}
        defaults={{
          reviewDate: review.review_date,
          nextReviewDate:
            review.next_review_date ?? defaultNextReviewDate(review.review_date),
          discussionNotes: review.discussion_notes ?? "",
          goalNotes: review.goal_notes ?? "",
          followUpRequired: review.follow_up_required,
          followUpNotes: review.follow_up_notes ?? "",
        }}
      />
    </>
  );
}
