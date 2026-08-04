"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = { error?: string };

/**
 * Minimum password rules.
 *
 * Length does more for real-world security than forced symbol classes, which
 * mostly push people towards "Password1!". Twelve characters is the floor.
 */
const schema = z
  .object({
    password: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(128, "That password is too long"),
    confirm: z.string(),
    fullName: z.string().trim().optional(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Both passwords must match",
    path: ["confirm"],
  });

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    fullName: formData.get("fullName") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createClient();

  // The session here comes from the emailed link, already exchanged by
  // /auth/callback. Without it there is nothing to update.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "That link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  // Invited users set their display name at the same time as their password.
  const name = parsed.data.fullName?.trim();
  if (name) {
    await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
