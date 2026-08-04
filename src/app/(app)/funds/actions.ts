"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";

/**
 * Watchlists are private to each user, enforced by RLS. There is no way to
 * see or change anyone else's.
 */
export async function toggleWatchlist(fundId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("fund_watchlists")
    .select("id")
    .eq("fund_id", fundId)
    .maybeSingle();

  if (existing) {
    await supabase.from("fund_watchlists").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("fund_watchlists")
      .insert({ user_id: profile.id, fund_id: fundId });
  }

  revalidatePath("/funds");
  revalidatePath(`/funds/${fundId}`);
  revalidatePath("/dashboard");
}
