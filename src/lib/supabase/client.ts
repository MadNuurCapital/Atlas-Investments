"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser Supabase client.
 *
 * Carries the anon key and the signed-in user's session. It has no privilege
 * of its own — every query it makes is filtered by Row Level Security in
 * Postgres. Even if someone rewrote the frontend code in their own browser,
 * they still could not read another advisor's clients.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
