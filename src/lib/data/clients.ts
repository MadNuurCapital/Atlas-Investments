import "server-only";

import { createClient } from "@/lib/supabase/server";
import { computeHoldingTotals, computePortfolioTotals } from "@/lib/calc/holdings";
import type { HoldingInput, HoldingTotals } from "@/lib/calc/holdings";
import { toISODate } from "@/lib/calc/dates";
import type {
  Client,
  ClientHolding,
  HoldingTransaction,
  Review,
} from "@/lib/supabase/types";

/**
 * Client data access.
 *
 * Everything here uses the user-scoped Supabase client, so Row Level
 * Security applies to every query. There is no ownership filtering written
 * in TypeScript — deliberately. If a query here forgot a `.eq('advisor_id',
 * …)` the database would still return nothing, because the policy is the
 * thing enforcing ownership. Belt-and-braces filtering would only hide a
 * policy mistake from us.
 */

/**
 * Supabase returns `numeric` columns as strings to preserve precision.
 * Converting once, here, keeps the rest of the app working in numbers
 * without every screen re-parsing.
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type HoldingWithTotals = ClientHolding & {
  transactions: HoldingTransaction[];
  totals: HoldingTotals;
  fundDisplayName: string;
};

function normaliseHolding(
  row: ClientHolding & { holding_transactions?: HoldingTransaction[] },
  asOf: string,
): HoldingWithTotals {
  const transactions = (row.holding_transactions ?? []).map((t) => ({
    ...t,
    amount: toNullableNumber(t.amount),
    new_monthly_amount: toNullableNumber(t.new_monthly_amount),
  }));

  const input: HoldingInput = {
    initialLumpSum: toNumber(row.initial_lump_sum),
    monthlyContribution: toNumber(row.monthly_contribution),
    startDate: row.start_date,
    currentValue: toNullableNumber(row.current_value),
    contributionsCeasedOn: row.contributions_ceased_on,
    contributedOverride: toNullableNumber(row.contributed_override),
    transactions: transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      newMonthlyAmount: t.new_monthly_amount,
      effectiveDate: t.effective_date,
    })),
  };

  return {
    ...row,
    initial_lump_sum: toNumber(row.initial_lump_sum),
    monthly_contribution: toNumber(row.monthly_contribution),
    current_value: toNullableNumber(row.current_value),
    contributed_override: toNullableNumber(row.contributed_override),
    transactions,
    totals: computeHoldingTotals(input, asOf),
    fundDisplayName: row.fund_name_manual ?? "Unlinked fund",
  };
}

export type ClientSummary = Client & {
  holdingCount: number;
  portfolio: ReturnType<typeof computePortfolioTotals>;
};

/**
 * Every client the signed-in advisor owns, with rolled-up figures.
 *
 * Holdings and transactions are fetched in one nested query rather than one
 * request per client, so a 200-client book is a single round trip.
 */
export async function listClients(options?: {
  search?: string;
  includeArchived?: boolean;
}): Promise<ClientSummary[]> {
  const supabase = await createClient();
  const asOf = toISODate(new Date());

  let query = supabase
    .from("clients")
    .select("*, client_holdings(*, holding_transactions(*))")
    .order("full_name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq("status", "active");
  }

  const search = options?.search?.trim();
  if (search) {
    // Escape the PostgREST `or` delimiters so a comma or bracket in a search
    // box cannot alter the filter expression.
    const safe = search.replace(/[,()]/g, " ");
    query = query.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load clients: ${error.message}`);

  return (data ?? []).map((row) => {
    const holdings = (row.client_holdings ?? [])
      .filter((h: ClientHolding) => h.archived_at === null)
      .map((h: ClientHolding) => normaliseHolding(h, asOf));

    // Drop the nested rows; the computed totals above replace them.
    const { client_holdings: _nested, ...client } = row;
    void _nested;

    return {
      ...(client as Client),
      holdingCount: holdings.length,
      portfolio: computePortfolioTotals(
        holdings.map((h) => ({ status: h.status, totals: h.totals })),
      ),
    };
  });
}

export type ClientDetail = Client & {
  holdings: HoldingWithTotals[];
  portfolio: ReturnType<typeof computePortfolioTotals>;
};

/** One client with holdings and transactions. Returns null if not yours. */
export async function getClient(
  clientId: string,
  asOf: string = toISODate(new Date()),
): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*, client_holdings(*, holding_transactions(*))")
    .eq("id", clientId)
    .maybeSingle();

  // A client belonging to another advisor is indistinguishable from one that
  // does not exist. That is the correct behaviour: confirming a record exists
  // is itself a disclosure.
  if (error || !data) return null;

  const holdings = (data.client_holdings ?? [])
    .filter((h: ClientHolding) => h.archived_at === null)
    .map((h: ClientHolding) => normaliseHolding(h, asOf))
    .sort((a: HoldingWithTotals, b: HoldingWithTotals) =>
      a.provider.localeCompare(b.provider) ||
      a.product_name.localeCompare(b.product_name),
    );

  const { client_holdings: _nested, ...client } = data;
  void _nested;

  return {
    ...(client as Client),
    holdings,
    portfolio: computePortfolioTotals(
      holdings.map((h: HoldingWithTotals) => ({ status: h.status, totals: h.totals })),
    ),
  };
}

export async function listClientReviews(clientId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("client_id", clientId)
    .order("review_date", { ascending: false });

  if (error) throw new Error(`Could not load reviews: ${error.message}`);
  return data ?? [];
}

/** Every transaction across a client's holdings, newest first. */
export async function listClientTransactions(clientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holding_transactions")
    .select("*, client_holdings!inner(id, provider, product_name, client_id)")
    .eq("client_holdings.client_id", clientId)
    .order("effective_date", { ascending: false });

  if (error) throw new Error(`Could not load transactions: ${error.message}`);

  return (data ?? []).map((row) => ({
    ...row,
    amount: toNullableNumber(row.amount),
    new_monthly_amount: toNullableNumber(row.new_monthly_amount),
  }));
}

/**
 * Value history for a client's chart, taken from completed review snapshots.
 *
 * Built from snapshots rather than recomputed, so the chart shows what the
 * client was actually told at each review.
 */
export async function getClientValueHistory(clientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("id, review_date, status, review_holding_snapshots(current_value, total_contributed)")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("review_date", { ascending: true });

  if (error) throw new Error(`Could not load value history: ${error.message}`);

  return (data ?? []).map((review) => {
    const snapshots = review.review_holding_snapshots ?? [];
    return {
      reviewId: review.id,
      date: review.review_date,
      value: snapshots.reduce(
        (total: number, s: { current_value: unknown }) => total + toNumber(s.current_value),
        0,
      ),
      contributed: snapshots.reduce(
        (total: number, s: { total_contributed: unknown }) => total + toNumber(s.total_contributed),
        0,
      ),
    };
  });
}
