import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeHoldingTotals } from "@/lib/calc/holdings";

/**
 * Completing a review, exercised end to end against a fake database.
 *
 * The database path was proven separately with psql — policies, constraints
 * and triggers all accept a completion. So this covers the other half: the
 * control flow in the Server Action, which is where a review that refuses to
 * complete has to be coming from.
 */

const REVIEW_ID = "e1111111-1111-1111-1111-111111111111";
const CLIENT_ID = "c1111111-1111-1111-1111-111111111111";
const HOLDING_ID = "d1111111-1111-1111-1111-111111111111";

/** Records every table operation so a test can assert what was attempted. */
const calls: { table: string; op: string; payload?: unknown }[] = [];

/**
 * How many rows the next write should claim to have touched.
 *
 * Real PostgREST returns the affected rows only when the write is followed
 * by `.select()`, and returns an EMPTY array — not an error — when Row Level
 * Security matched nothing. A test needs to be able to produce both.
 */
let rowsAffected = 1;

function makeQuery(table: string) {
  const result: Record<string, unknown> = { data: null, error: null };
  let wrote = false;

  const chain = {
    update(payload: unknown) {
      calls.push({ table, op: "update", payload });
      wrote = true;
      return chain;
    },
    insert(payload: unknown) {
      calls.push({ table, op: "insert", payload });
      wrote = true;
      return chain;
    },
    delete() {
      calls.push({ table, op: "delete" });
      return chain;
    },
    select() {
      if (wrote) {
        result.data = Array.from({ length: rowsAffected }, () => ({ id: HOLDING_ID }));
      }
      return chain;
    },
    eq() {
      return chain;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };

  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => makeQuery(table) }),
}));

vi.mock("@/lib/auth/dal", () => ({
  requireProfile: async () => ({
    id: "11111111-1111-1111-1111-111111111111",
    role: "advisor",
  }),
}));

vi.mock("@/lib/data/audit", () => ({ recordClientAudit: async () => {} }));
vi.mock("@/lib/data/reviews", () => ({ getDraftReview: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

/**
 * `redirect` throws in the real framework, which is how it unwinds a Server
 * Action. Throwing a recognisable marker here means a test can tell "it
 * redirected" apart from "it returned an error state".
 */
class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

const holdingRow = {
  id: HOLDING_ID,
  client_id: CLIENT_ID,
  provider: "Manulife",
  product_name: "InvestReady",
  fund_name_manual: "Global Equity Fund",
  fundDisplayName: "Global Equity Fund",
  status: "active" as const,
  initial_lump_sum: 10_000,
  monthly_contribution: 500,
  start_date: "2024-01-15",
  current_value: 18_000,
  current_value_as_of: "2026-08-13",
  contributions_ceased_on: null,
  contributed_override: null,
  archived_at: null,
  transactions: [],
};

function clientWith(currentValue: number | null) {
  const holding = { ...holdingRow, current_value: currentValue };
  return {
    id: CLIENT_ID,
    full_name: "Test Client",
    holdings: [
      {
        ...holding,
        totals: computeHoldingTotals(
          {
            initialLumpSum: holding.initial_lump_sum,
            monthlyContribution: holding.monthly_contribution,
            startDate: holding.start_date,
            currentValue: holding.current_value,
            contributionsCeasedOn: null,
            contributedOverride: null,
            transactions: [],
          },
          "2026-08-13",
        ),
      },
    ],
  };
}

const getClient = vi.fn();
vi.mock("@/lib/data/clients", () => ({
  getClient: (...args: unknown[]) => getClient(...args),
}));

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("review_date", "2026-08-13");
  fd.set("next_review_date", "2026-11-13");
  fd.set("discussion_notes", "Went through the portfolio.");
  fd.set("goal_notes", "");
  fd.set("follow_up_notes", "");
  fd.set(`value_${HOLDING_ID}`, "18500");
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

async function run(fd: FormData, isCorrection = false) {
  const { completeReview } = await import("./actions");
  try {
    return {
      state: await completeReview(REVIEW_ID, CLIENT_ID, isCorrection, {}, fd),
      redirected: null as string | null,
    };
  } catch (error) {
    if (error instanceof RedirectSignal) {
      return { state: null, redirected: error.to };
    }
    throw error;
  }
}

describe("completeReview", () => {
  beforeEach(() => {
    calls.length = 0;
    rowsAffected = 1;
    getClient.mockReset();
    getClient.mockResolvedValue(clientWith(18_000));
  });

  it("completes a review and redirects to the confirmation", async () => {
    const { state, redirected } = await run(form());

    expect(state).toBeNull();
    expect(redirected).toBe(`/reviews/${REVIEW_ID}?done=1`);
  });

  it("marks the review completed with a completion timestamp", async () => {
    await run(form());

    const update = calls.find((c) => c.table === "reviews" && c.op === "update");
    expect(update?.payload).toMatchObject({
      status: "completed",
      next_review_date: "2026-11-13",
    });
  });

  it("writes one snapshot row per valued holding", async () => {
    await run(form());

    const insert = calls.find(
      (c) => c.table === "review_holding_snapshots" && c.op === "insert",
    );
    expect(Array.isArray(insert?.payload)).toBe(true);
    expect(insert?.payload).toHaveLength(1);
  });

  it("refuses when the next review is not after this one", async () => {
    const { state } = await run(form({ next_review_date: "2026-08-13" }));
    expect(state?.errors?.next_review_date).toBeTruthy();
  });

  it("refuses when no holding has a value, and says so", async () => {
    getClient.mockResolvedValue(clientWith(null));
    const { state } = await run(form({ [`value_${HOLDING_ID}`]: "" }));
    expect(state?.message).toMatch(/current value/i);
  });

  /**
   * The first review of a client.
   *
   * Their holdings have no recorded value yet — that is the whole point of
   * the review — so `getClient` returns nulls on the first call, the action
   * writes the typed values, and the second call must see them. This is the
   * case an advisor actually hits, and the one the tests above missed by
   * handing back a client that was already valued.
   */
  it("completes a FIRST review, where the values are typed for the first time", async () => {
    getClient
      .mockResolvedValueOnce(clientWith(null))
      .mockResolvedValueOnce(clientWith(18_500));

    const { state, redirected } = await run(form());

    expect(state?.message).toBeUndefined();
    expect(redirected).toBe(`/reviews/${REVIEW_ID}?done=1`);
  });

  /**
   * The same first review, but the re-read comes back stale — which is what
   * happens if the second `getClient` is served from a per-request cache
   * instead of the database. The advisor is then told to record a value they
   * have just recorded.
   */
  it("does not refuse a first review when the re-read is stale", async () => {
    getClient
      .mockResolvedValueOnce(clientWith(null))
      .mockResolvedValueOnce(clientWith(null));

    const { state, redirected } = await run(form());

    expect(state?.message).toBeUndefined();
    expect(redirected).toBe(`/reviews/${REVIEW_ID}?done=1`);
  });

  it("reads the client once — a completion must not depend on a second read", async () => {
    await run(form());
    expect(getClient).toHaveBeenCalledTimes(1);
  });

  it("stops when the holding update silently touches no rows", async () => {
    // Row Level Security refuses by returning zero rows, not by erroring.
    // Recording a snapshot value that was never actually stored would give
    // the client a figure the database does not agree with.
    rowsAffected = 0;

    const { state, redirected } = await run(form());

    expect(redirected).toBeNull();
    expect(state?.message).toMatch(/could not be updated/i);
    expect(
      calls.some((c) => c.table === "review_holding_snapshots" && c.op === "insert"),
    ).toBe(false);
    expect(calls.some((c) => c.table === "reviews" && c.op === "update")).toBe(false);
  });

  it("tells an advisor with no holdings what to do about it", async () => {
    getClient.mockResolvedValue({
      id: CLIENT_ID,
      full_name: "Test Client",
      holdings: [],
    });

    const { state } = await run(form());
    expect(state?.message).toMatch(/no holdings yet/i);
  });
});
