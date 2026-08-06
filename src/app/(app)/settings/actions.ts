"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../clients/actions";

/**
 * Your own account.
 *
 * Everything here is deliberately narrow. `profiles` has an UPDATE policy that
 * lets you change your own row, and the `protect_profile_fields()` trigger
 * refuses any change to `role` or `is_active` from an ordinary session — so
 * even if this file were rewritten to send them, the database would decline.
 * The narrowness below is politeness; the enforcement is in Postgres.
 */

const nameSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(120, "That name is too long"),
});

export async function updateMyName(
  _prev: FormState & { ok?: boolean },
  formData: FormData,
): Promise<FormState & { ok?: boolean }> {
  const profile = await requireProfile();

  const parsed = nameSchema.safeParse({ full_name: formData.get("full_name") ?? "" });
  if (!parsed.success) {
    return { errors: { full_name: parsed.error.issues[0].message } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", profile.id);

  if (error) return { message: `Could not save your name: ${error.message}` };

  // The name appears in the header on every screen and on client snapshots,
  // so the whole tree is revalidated rather than this page alone.
  revalidatePath("/", "layout");
  return { ok: true, message: "Your name has been updated." };
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(128, "That password is too long"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Both passwords must match",
    path: ["confirm"],
  });

export async function changeMyPassword(
  _prev: FormState & { ok?: boolean },
  formData: FormData,
): Promise<FormState & { ok?: boolean }> {
  await requireProfile();

  const parsed = passwordSchema.safeParse({
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { errors: { [String(issue.path[0] ?? "password")]: issue.message } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return { message: error.message };

  return { ok: true, message: "Your password has been changed." };
}
