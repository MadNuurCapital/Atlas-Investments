"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export type ResetState = { error?: string; sent?: boolean };

export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = z.email().safeParse(formData.get("email"));

  if (!parsed.success) {
    return { error: "Enter a valid email address" };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/update-password`,
  });

  // Always report success, even for an address with no account. Doing
  // otherwise turns this form into a way to discover who works here.
  return { sent: true };
}
