import { describe, expect, it } from "vitest";
import { bucketByReminder, getReminder } from "./reminders";

const TODAY = "2026-08-04";

describe("getReminder buckets", () => {
  const cases: [string, string][] = [
    ["2026-07-28", "overdue"],
    ["2026-08-03", "overdue"],
    ["2026-08-04", "due_7"],
    ["2026-08-11", "due_7"],
    ["2026-08-12", "due_14"],
    ["2026-08-18", "due_14"],
    ["2026-08-19", "due_30"],
    ["2026-09-03", "due_30"],
    ["2026-09-04", "scheduled"],
  ];

  for (const [date, bucket] of cases) {
    it(`${date} falls in ${bucket}`, () => {
      expect(getReminder(date, null, TODAY).bucket).toBe(bucket);
    });
  }

  it("reports no review scheduled rather than guessing", () => {
    const reminder = getReminder(null, null, TODAY);
    expect(reminder.bucket).toBe("none");
    expect(reminder.label).toBe("No review scheduled");
  });
});

describe("reminder wording", () => {
  it("reads naturally at the boundaries", () => {
    expect(getReminder("2026-08-04", null, TODAY).label).toBe("Due today");
    expect(getReminder("2026-08-05", null, TODAY).label).toBe("Due tomorrow");
    expect(getReminder("2026-08-09", null, TODAY).label).toBe("Due in 5 days");
    expect(getReminder("2026-08-03", null, TODAY).label).toBe("Overdue by 1 day");
    expect(getReminder("2026-07-28", null, TODAY).label).toBe("Overdue by 7 days");
  });
});

describe("snoozing", () => {
  it("marks a reminder snoozed while the snooze is in the future", () => {
    expect(getReminder("2026-08-06", "2026-08-20", TODAY).isSnoozed).toBe(true);
  });

  it("stops applying once the snooze date passes", () => {
    expect(getReminder("2026-08-06", "2026-08-01", TODAY).isSnoozed).toBe(false);
    expect(getReminder("2026-08-06", TODAY, TODAY).isSnoozed).toBe(false);
  });

  it("NEVER removes an overdue review from the overdue bucket", () => {
    // This is the point of the design: snoozing lowers the volume, it does
    // not make the obligation disappear.
    const reminder = getReminder("2026-06-01", "2026-12-31", TODAY);
    expect(reminder.bucket).toBe("overdue");
    expect(reminder.isSnoozed).toBe(true);
  });
});

describe("bucketByReminder", () => {
  const clients = [
    { id: "a", next_review_date: "2026-06-01", reminder_snoozed_until: null },
    { id: "b", next_review_date: "2026-08-06", reminder_snoozed_until: null },
    { id: "c", next_review_date: "2026-08-30", reminder_snoozed_until: null },
    { id: "d", next_review_date: null, reminder_snoozed_until: null },
    { id: "e", next_review_date: "2026-07-01", reminder_snoozed_until: null },
  ];

  it("sorts every client into exactly one bucket", () => {
    const buckets = bucketByReminder(clients, TODAY);
    expect(buckets.overdue.map((c) => c.id)).toEqual(["a", "e"]);
    expect(buckets.due_7.map((c) => c.id)).toEqual(["b"]);
    expect(buckets.due_30.map((c) => c.id)).toEqual(["c"]);
    expect(buckets.none.map((c) => c.id)).toEqual(["d"]);

    const total = Object.values(buckets).reduce((n, b) => n + b.length, 0);
    expect(total).toBe(clients.length);
  });

  it("puts the most overdue client first", () => {
    const buckets = bucketByReminder(clients, TODAY);
    expect(buckets.overdue[0].id).toBe("a");
  });

  it("handles an empty book", () => {
    const buckets = bucketByReminder([], TODAY);
    expect(buckets.overdue).toEqual([]);
  });
});
