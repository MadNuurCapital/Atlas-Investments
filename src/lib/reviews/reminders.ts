import { daysBetween } from "@/lib/calc/dates";
import { toISODate } from "@/lib/calc/dates";

/**
 * Review reminders.
 *
 * Computed from each client's next_review_date rather than stored as
 * notification rows. A stored notification can go stale — the review date
 * changes and the reminder still says the old thing. Deriving it means the
 * reminder is always correct by construction.
 *
 * The only state we persist is a snooze date, which quietens a reminder
 * without ever removing the obligation: an overdue review still counts in
 * the overdue total no matter how many times it has been snoozed.
 */

export type ReminderBucket = "overdue" | "due_7" | "due_14" | "due_30" | "scheduled" | "none";

export type Reminder = {
  bucket: ReminderBucket;
  /** Negative once overdue. */
  daysUntilDue: number;
  label: string;
  /** True when snoozed past today — display quietly, but still count it. */
  isSnoozed: boolean;
};

export const BUCKET_ORDER: readonly ReminderBucket[] = [
  "overdue",
  "due_7",
  "due_14",
  "due_30",
];

export const BUCKET_LABELS: Record<ReminderBucket, string> = {
  overdue: "Overdue",
  due_7: "Due within 7 days",
  due_14: "Due within 14 days",
  due_30: "Due within 30 days",
  scheduled: "Scheduled",
  none: "No review scheduled",
};

function describe(days: number): string {
  if (days < 0) {
    const overdueBy = Math.abs(days);
    return overdueBy === 1 ? "Overdue by 1 day" : `Overdue by ${overdueBy} days`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function getReminder(
  nextReviewDate: string | null,
  snoozedUntil: string | null,
  today: string = toISODate(new Date()),
): Reminder {
  if (!nextReviewDate) {
    return {
      bucket: "none",
      daysUntilDue: Number.POSITIVE_INFINITY,
      label: BUCKET_LABELS.none,
      isSnoozed: false,
    };
  }

  const daysUntilDue = daysBetween(today, nextReviewDate);
  const isSnoozed = snoozedUntil ? daysBetween(today, snoozedUntil) > 0 : false;

  const bucket: ReminderBucket =
    daysUntilDue < 0
      ? "overdue"
      : daysUntilDue <= 7
        ? "due_7"
        : daysUntilDue <= 14
          ? "due_14"
          : daysUntilDue <= 30
            ? "due_30"
            : "scheduled";

  return {
    bucket,
    daysUntilDue,
    label: bucket === "scheduled" ? describe(daysUntilDue) : describe(daysUntilDue),
    isSnoozed,
  };
}

/** Group clients into reminder buckets for the dashboard and review queue. */
export function bucketByReminder<T extends { next_review_date: string | null; reminder_snoozed_until: string | null }>(
  clients: readonly T[],
  today: string = toISODate(new Date()),
): Record<ReminderBucket, (T & { reminder: Reminder })[]> {
  const buckets: Record<ReminderBucket, (T & { reminder: Reminder })[]> = {
    overdue: [],
    due_7: [],
    due_14: [],
    due_30: [],
    scheduled: [],
    none: [],
  };

  for (const client of clients) {
    const reminder = getReminder(
      client.next_review_date,
      client.reminder_snoozed_until,
      today,
    );
    buckets[reminder.bucket].push({ ...client, reminder });
  }

  // Most urgent first within each bucket.
  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => a.reminder.daysUntilDue - b.reminder.daysUntilDue);
  }

  return buckets;
}
