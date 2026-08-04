import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { getClient, listClientReviews } from "@/lib/data/clients";
import { formatSgDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reviews" };

export default async function ClientReviewsPage({
  params,
}: PageProps<"/clients/[id]/reviews">) {
  const { id } = await params;
  const [client, reviews] = await Promise.all([getClient(id), listClientReviews(id)]);
  if (!client) notFound();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`/reviews/start/${id}`} className={buttonVariants()}>
          <Play className="size-4" />
          Start review
        </Link>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Completing a review captures a snapshot of every holding, so the client's value history builds up over time."
          action={
            <Link href={`/reviews/start/${id}`} className={buttonVariants()}>
              Start the first review
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Review date</TH>
              <TH>Status</TH>
              <TH>Next review</TH>
              <TH>Follow-up</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {reviews.map((review) => (
              <TR key={review.id}>
                <TD>{formatSgDate(review.review_date)}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Badge tone={review.status === "completed" ? "positive" : "info"}>
                      {review.status === "completed" ? "Completed" : "In progress"}
                    </Badge>
                    {review.correction_count > 0 && (
                      <Badge tone="warning">Corrected</Badge>
                    )}
                  </div>
                </TD>
                <TD>{formatSgDate(review.next_review_date)}</TD>
                <TD>
                  {review.follow_up_required ? (
                    <Badge tone="warning">Required</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </TD>
                <TD>
                  <Link
                    href={`/reviews/${review.id}`}
                    className="text-sm font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                  >
                    {review.status === "completed" ? "View" : "Continue"}
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
