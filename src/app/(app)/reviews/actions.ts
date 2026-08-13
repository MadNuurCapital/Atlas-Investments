"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";
import { recordClientAudit } from "@/lib/data/audit";
import { getClient } from "@/lib/data/clients";
import { getDraftReview } from "@/lib/data/reviews";
import {
  addMonths,
  defaultNextReviewDate,
  parseDate,
  toISODate,
} from "@/lib/calc/dates";
import { computeHoldingTotals } from "@/lib/calc/holdings";
import {
  dateField,
  fieldErrors,
  optionalMoneyField,
  optionalText,
  requiredText,
} from "@/lib/validation";
import type { FormState } from "../clients/actions";

/**
 * Begin a review, or resume the one already in progress.
 *
 * The database has a unique index allowing only one draft per client, so two
 * half-finished reviews of the same person cannot exist. Rather than showing
 * an error when one is already open, this resumes it — which is what the
 * advisor meant.
 */
export async function startReview(clientId: string): Promise<never> {
  const profile = await requireProfile();

  const existing = await getDraftReview(clientId);
  if (existing) redirect(`/reviews/${existing.id}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      client_id: clientId,
      advisor_id: profile.id,
      review_date: toISODate(new Date()),
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    // Almost always the unique-draft index losing a race with another tab.
    const raced = await getDraftReview(clientId);
    if (raced) redirect(`/reviews/${raced.id}`);
    throw new Error(`Could not start a review: ${error?.message ?? "unknown error"}`);
  }

  revalidatePath("/reviews");
  redirect(`/reviews/${data.id}`);
}

const reviewSchema = z.object({
  review_date: dateField("Review date"),
  discussion_notes: optionalText(10_000),
  goal_notes: optionalText(5_000),
  follow_up_required: z.union([z.literal("on"), z.literal(""), z.null()]).transform(
    (value) => value === "on",
  ),
  follow_up_notes: optionalText(2_000),
  next_review_date: dateField("Next review date", { allowFuture: true }),
});

/**
 * Complete a review, or correct one already completed.
 *
 * Both paths run the same code deliberately: a correction must produce
 * exactly the state a first-time completion would have, so a corrected
 * review is indistinguishable from one entered correctly the first time —
 * except for the visible "Corrected" marker and the audit record.
 */
export async function completeReview(
  reviewId: string,
  clientId: string,
  isCorrection: boolean,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = reviewSchema.safeParse({
    review_date: formData.get("review_date") ?? "",
    discussion_notes: formData.get("discussion_notes") ?? "",
    goal_notes: formData.get("goal_notes") ?? "",
    follow_up_required: formData.get("follow_up_required"),
    next_review_date: formData.get("next_review_date") ?? "",
    follow_up_notes: formData.get("follow_up_notes") ?? "",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (
    parseDate(parsed.data.next_review_date) <= parseDate(parsed.data.review_date)
  ) {
    return { errors: { next_review_date: "The next review must be after this one" } };
  }

  let reason: string | null = null;
  if (isCorrection) {
    const reasonParsed = requiredText("Reason for the correction", 500).safeParse(
      formData.get("correction_reason") ?? "",
    );
    if (!reasonParsed.success) {
      return { errors: { correction_reason: reasonParsed.error.issues[0].message } };
    }
    reason = reasonParsed.data;
  }

  const client = await getClient(clientId, parsed.data.review_date);
  if (!client) return { message: "This client is no longer available." };

  const supabase = await createClient();

  // --- 1. Apply the updated current values to each holding ---------------
  const valueSchema = optionalMoneyField("Current value");
  const updatedValues: { holdingId: string; value: number | null }[] = [];

  for (const holding of client.holdings) {
    const raw = formData.get(`value_${holding.id}`);
    if (raw === null) continue;

    const value = valueSchema.safeParse(raw);
    if (!value.success) {
      return {
        errors: { [`value_${holding.id}`]: value.error.issues[0].message },
      };
    }
    updatedValues.push({ holdingId: holding.id, value: value.data });
  }

  for (const { holdingId, value } of updatedValues) {
    if (value === null) continue;
    const { data: affected, error } = await supabase
      .from("client_holdings")
      .update({
        current_value: value,
        current_value_as_of: parsed.data.review_date,
      })
      .eq("id", holdingId)
      // `.select()` matters. Without it an update that matches no rows —
      // because Row Level Security hid them — returns no error at all, and
      // the review would go on to record a value that was never stored.
      .select("id");

    if (error) return { message: `Could not update a holding: ${error.message}` };

    if (!affected || affected.length === 0) {
      return {
        message:
          "That holding could not be updated. It may have been archived or reassigned — reload this page and try again.",
      };
    }
  }

  // --- 2. Merge the applied values -------------------------------------
  //
  // Deliberately NOT a second read of the client.
  //
  // This used to re-fetch and rebuild the snapshot from whatever came back,
  // which made completing a review depend on the write above being visible
  // to the very next read. When it was not, every holding still looked
  // unvalued, the snapshot came out empty, and the advisor was told to
  // "record a current value" — the exact thing they had just done, on the
  // screen in front of them. It struck hardest on a client's FIRST review,
  // where no holding had a previous value to fall back on.
  //
  // The action already knows what it applied. Using that is correct, immune
  // to read-after-write lag, and one round trip cheaper.
  const applied = new Map(updatedValues.map(({ holdingId, value }) => [holdingId, value]));

  const valued = client.holdings
    .map((holding) => {
      const submitted = applied.get(holding.id);
      // A blank box leaves the stored value alone rather than clearing it.
      const currentValue =
        submitted !== undefined && submitted !== null ? submitted : holding.current_value;
      return { holding, currentValue };
    })
    .filter((entry) => entry.currentValue !== null);

  // --- 3. Replace the snapshots -----------------------------------------
  // A correction rebuilds them wholesale. Snapshot rows themselves are
  // immutable — enforced by a database trigger — so replacing is the only
  // legitimate way to change what a review recorded.
  if (isCorrection) {
    await supabase.from("review_holding_snapshots").delete().eq("review_id", reviewId);
  }

  const snapshots = valued.map(({ holding, currentValue }) => {
    const totals = computeHoldingTotals(
      {
        initialLumpSum: holding.initial_lump_sum,
        monthlyContribution: holding.monthly_contribution,
        startDate: holding.start_date,
        currentValue,
        contributionsCeasedOn: holding.contributions_ceased_on,
        contributedOverride: holding.contributed_override,
        transactions: holding.transactions.map((t) => ({
          type: t.type,
          amount: t.amount,
          newMonthlyAmount: t.new_monthly_amount,
          effectiveDate: t.effective_date,
        })),
      },
      parsed.data.review_date,
    );

    return {
      review_id: reviewId,
      holding_id: holding.id,
      provider: holding.provider,
      product_name: holding.product_name,
      fund_display_name: holding.fundDisplayName,
      status: holding.status,
      monthly_contribution: totals.monthlyContributionNow,
      total_contributed: totals.totalContributed,
      current_value: currentValue as number,
      withdrawals_to_date: totals.withdrawals,
      dividends_to_date: totals.dividends,
      gain_loss_amount: totals.gainLoss ?? 0,
      gain_loss_fraction: totals.gainLossFraction,
    };
  });

  if (snapshots.length === 0) {
    // Distinguish the two reasons, because the advice differs and the old
    // single message was actively misleading in the second case.
    return {
      message:
        client.holdings.length === 0
          ? "This client has no holdings yet. Add one on the Investments tab before completing a review."
          : "Enter a current value for at least one holding above, then complete the review.",
    };
  }

  const { error: snapshotError } = await supabase
    .from("review_holding_snapshots")
    .insert(snapshots);

  if (snapshotError) {
    return { message: `Could not save the review snapshot: ${snapshotError.message}` };
  }

  // --- 4. Mark the review complete --------------------------------------
  const { data: before } = await supabase
    .from("reviews")
    .select("correction_count, review_date, next_review_date, completed_at")
    .eq("id", reviewId)
    .maybeSingle();

  const { error: reviewError } = await supabase
    .from("reviews")
    .update({
      ...parsed.data,
      status: "completed",
      completed_at: before?.completed_at ?? new Date().toISOString(),
      ...(isCorrection
        ? {
            corrected_at: new Date().toISOString(),
            correction_count: (before?.correction_count ?? 0) + 1,
          }
        : {}),
    })
    .eq("id", reviewId);

  if (reviewError) return { message: `Could not complete: ${reviewError.message}` };

  // --- 5. Move the client's next review date on -------------------------
  const { error: clientError } = await supabase
    .from("clients")
    .update({
      next_review_date: parsed.data.next_review_date,
      // A completed review clears any snooze: the obligation is discharged.
      reminder_snoozed_until: null,
    })
    .eq("id", clientId);

  if (clientError) return { message: `Could not update the client: ${clientError.message}` };

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "reviews",
    entityId: reviewId,
    action: isCorrection ? "correct_review" : "complete_review",
    before: before ?? null,
    after: {
      review_date: parsed.data.review_date,
      next_review_date: parsed.data.next_review_date,
      holdings_valued: snapshots.length,
    },
    reason,
  });

  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/reviews/${reviewId}?done=1`);
}

/** Save progress without completing. */
export async function saveReviewDraft(
  reviewId: string,
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("reviews")
    .update({
      discussion_notes: (formData.get("discussion_notes") as string) || null,
      goal_notes: (formData.get("goal_notes") as string) || null,
      follow_up_notes: (formData.get("follow_up_notes") as string) || null,
      follow_up_required: formData.get("follow_up_required") === "on",
    })
    .eq("id", reviewId);

  if (error) return { message: `Could not save: ${error.message}` };

  revalidatePath(`/reviews/${reviewId}`);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Draft saved." };
}

export async function abandonReview(reviewId: string, clientId: string): Promise<never> {
  await requireProfile();
  const supabase = await createClient();

  // Only a draft can be discarded. A completed review is part of the client's
  // record and is corrected, never thrown away.
  await supabase
    .from("review_holding_snapshots")
    .delete()
    .eq("review_id", reviewId);

  await supabase
    .from("reviews")
    .update({ status: "draft" })
    .eq("id", reviewId)
    .eq("status", "draft");

  revalidatePath("/reviews");
  redirect(`/clients/${clientId}`);
}

/**
 * Quieten a reminder for a while.
 *
 * Snoozing never removes an overdue review from the overdue count. It lowers
 * the volume; only completing the review discharges the obligation.
 */
export async function snoozeReminder(
  clientId: string,
  days: number,
): Promise<void> {
  await requireProfile();
  const supabase = await createClient();

  const until = toISODate(addMonths(new Date(), 0));
  const target = new Date(until);
  target.setUTCDate(target.getUTCDate() + days);

  await supabase
    .from("clients")
    .update({ reminder_snoozed_until: toISODate(target) })
    .eq("id", clientId);

  revalidatePath("/reviews");
  revalidatePath("/dashboard");
}

export { defaultNextReviewDate };
