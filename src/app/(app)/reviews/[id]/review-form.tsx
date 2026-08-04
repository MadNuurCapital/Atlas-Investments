"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, ErrorNotice } from "@/components/ui/card";
import { Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  formatPercent,
  formatSgDate,
  formatSgd,
  formatSignedSgd,
} from "@/lib/format";
import type { FormState } from "../../clients/actions";

export type ReviewHoldingRow = {
  id: string;
  provider: string;
  productName: string;
  fundDisplayName: string;
  status: string;
  currentValue: number | null;
  currentValueAsOf: string | null;
  totalContributed: number;
  gainLoss: number | null;
  gainLossFraction: number | null;
  monthlyContribution: number;
  /** What the last completed review recorded, for comparison. */
  previousValue: number | null;
  previousDate: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ReviewForm({
  action,
  holdings,
  defaults,
  isCorrection,
  previousNotes,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  holdings: ReviewHoldingRow[];
  defaults: {
    reviewDate: string;
    nextReviewDate: string;
    discussionNotes: string;
    goalNotes: string;
    followUpRequired: boolean;
    followUpNotes: string;
  };
  isCorrection: boolean;
  previousNotes: string | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [reviewDate, setReviewDate] = useState(defaults.reviewDate);
  const [nextReviewDate, setNextReviewDate] = useState(defaults.nextReviewDate);

  /**
   * Moving the review date pulls the next one along with it, keeping the
   * three-month cycle intact without the advisor recomputing it. Editing the
   * next date directly still wins — it is a suggestion, not a lock.
   */
  function onReviewDateChange(value: string) {
    setReviewDate(value);
    if (!value) return;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return;

    const day = parsed.getUTCDate();
    const target = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 3, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    setNextReviewDate(target.toISOString().slice(0, 10));
  }

  return (
    <form action={formAction} className="space-y-6">
      {isCorrection && (
        <Card className="border-[var(--warning)] bg-[var(--warning-surface)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Correcting a completed review
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                This replaces the values the client was shown and rebuilds the
                snapshot. The change is recorded in this client&apos;s history
                and the review will be marked as corrected.
              </p>
              <div className="mt-3">
                <Field
                  label="Reason for the correction"
                  htmlFor="correction_reason"
                  required
                  error={state.errors?.correction_reason}
                >
                  <Input
                    id="correction_reason"
                    name="correction_reason"
                    placeholder="e.g. Provider statement showed a different value"
                    required
                  />
                </Field>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Holdings — record the value from the latest statement</CardTitle>

        {holdings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This client has no holdings. Add one before completing a review.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Holding</TH>
                <TH numeric>Contributed</TH>
                <TH numeric>Last review</TH>
                <TH numeric>Current value</TH>
                <TH numeric>Gain / loss</TH>
              </TR>
            </THead>
            <TBody>
              {holdings.map((holding) => (
                <TR key={holding.id}>
                  <TD>
                    <p className="font-medium text-foreground">{holding.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {holding.provider} · {holding.fundDisplayName}
                    </p>
                  </TD>
                  <TD numeric>{formatSgd(holding.totalContributed)}</TD>
                  <TD numeric>
                    {formatSgd(holding.previousValue)}
                    {holding.previousDate && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatSgDate(holding.previousDate)}
                      </p>
                    )}
                  </TD>
                  <TD>
                    <MoneyInput
                      name={`value_${holding.id}`}
                      defaultValue={holding.currentValue ?? ""}
                      aria-label={`Current value for ${holding.productName}`}
                      className="w-40"
                    />
                    {state.errors?.[`value_${holding.id}`] && (
                      <p className="mt-1 text-xs text-[var(--negative)]">
                        {state.errors[`value_${holding.id}`]}
                      </p>
                    )}
                  </TD>
                  <TD numeric>
                    <span
                      className={
                        holding.gainLoss === null
                          ? "text-subtle-foreground"
                          : holding.gainLoss > 0
                            ? "text-[var(--positive)]"
                            : holding.gainLoss < 0
                              ? "text-[var(--negative)]"
                              : ""
                      }
                    >
                      {formatSignedSgd(holding.gainLoss)}
                    </span>
                    <p className="text-xs font-normal text-muted-foreground">
                      {formatPercent(holding.gainLossFraction, { signed: true })}
                    </p>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Gain/loss updates once the review is saved. Record withdrawals,
          additional lump sums and dividends on the client&apos;s Transactions
          tab so they are counted correctly.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Discussion</CardTitle>
          <div className="space-y-5">
            {previousNotes && (
              <div className="rounded-md bg-surface-sunken p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                  Last review&apos;s notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {previousNotes}
                </p>
              </div>
            )}

            <Field
              label="Discussion notes"
              htmlFor="discussion_notes"
              hint="Internal. Never appears on a client snapshot or PDF."
              error={state.errors?.discussion_notes}
            >
              <Textarea
                id="discussion_notes"
                name="discussion_notes"
                rows={6}
                defaultValue={defaults.discussionNotes}
              />
            </Field>

            <Field
              label="Goal changes"
              htmlFor="goal_notes"
              error={state.errors?.goal_notes}
            >
              <Textarea
                id="goal_notes"
                name="goal_notes"
                rows={3}
                defaultValue={defaults.goalNotes}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Dates and follow-up</CardTitle>
          <div className="space-y-5">
            <Field
              label="Review date"
              htmlFor="review_date"
              required
              error={state.errors?.review_date}
            >
              <Input
                id="review_date"
                name="review_date"
                type="date"
                value={reviewDate}
                onChange={(event) => onReviewDateChange(event.target.value)}
                required
              />
            </Field>

            <Field
              label="Next review date"
              htmlFor="next_review_date"
              required
              hint="Suggested three months on. Adjust if you have agreed otherwise."
              error={state.errors?.next_review_date}
            >
              <Input
                id="next_review_date"
                name="next_review_date"
                type="date"
                value={nextReviewDate}
                onChange={(event) => setNextReviewDate(event.target.value)}
                required
              />
            </Field>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="follow_up_required"
                defaultChecked={defaults.followUpRequired}
                className="mt-0.5 size-4 rounded border-[var(--border-strong)]"
              />
              <span className="text-sm text-foreground">Follow-up required</span>
            </label>

            <Field
              label="Follow-up notes"
              htmlFor="follow_up_notes"
              error={state.errors?.follow_up_notes}
            >
              <Textarea
                id="follow_up_notes"
                name="follow_up_notes"
                rows={3}
                defaultValue={defaults.followUpNotes}
              />
            </Field>
          </div>
        </Card>
      </div>

      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}

      <div className="flex items-center gap-3">
        <Submit label={isCorrection ? "Save correction" : "Complete review"} />
        <p className="text-sm text-muted-foreground">
          Completing captures a snapshot of these figures and moves the next
          review date on.
        </p>
      </div>
    </form>
  );
}
