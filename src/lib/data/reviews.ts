import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Review, ReviewHoldingSnapshot } from "@/lib/supabase/types";

export type ReviewWithSnapshots = Review & {
  review_holding_snapshots: ReviewHoldingSnapshot[];
  clients: { id: string; full_name: string; next_review_date: string | null } | null;
};

export async function getReview(reviewId: string): Promise<ReviewWithSnapshots | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("*, review_holding_snapshots(*), clients(id, full_name, next_review_date)")
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as ReviewWithSnapshots;
}

/** The most recent completed review before a given date, for comparison. */
export async function getPreviousReview(
  clientId: string,
  beforeDate: string,
): Promise<ReviewWithSnapshots | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select("*, review_holding_snapshots(*), clients(id, full_name, next_review_date)")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .lt("review_date", beforeDate)
    .order("review_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as unknown as ReviewWithSnapshots) ?? null;
}

/** Any review currently in progress for this client. */
export async function getDraftReview(clientId: string): Promise<Review | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "draft")
    .maybeSingle();

  return data ?? null;
}

/** Recently completed reviews across the advisor's whole book. */
export async function listRecentReviews(limit = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("*, clients(id, full_name)")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load reviews: ${error.message}`);
  return data ?? [];
}
