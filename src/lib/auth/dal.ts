import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Data Access Layer.
 *
 * This is the real authentication boundary. `proxy.ts` does a fast optimistic
 * cookie check to keep signed-out users off the app, but a cookie can be
 * stale or forged, so nothing may rely on it alone. Every protected page and
 * Server Action calls through here, close to the data.
 *
 * Three layers guard client records, and each one is independently sufficient:
 *   1. proxy.ts   — optimistic redirect, for speed
 *   2. this DAL   — verified user and active profile, on the server
 *   3. Postgres RLS — ownership enforced in the database
 */

/**
 * The signed-in user's profile, or null.
 *
 * `getUser()` revalidates the token with the Supabase auth server rather than
 * trusting the cookie's contents, which is why this is used instead of
 * `getSession()`. Wrapped in React's `cache` so several components on one page
 * share a single round trip.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile ?? null;
});

/**
 * Require an active signed-in user. Redirects otherwise.
 *
 * A deactivated user is bounced to an explanatory page rather than a generic
 * login loop, so they can tell the difference between "wrong password" and
 * "your access was withdrawn".
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/account-inactive");

  return profile;
}

/** Require an active administrator. Anything else is a 404-style refusal. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
