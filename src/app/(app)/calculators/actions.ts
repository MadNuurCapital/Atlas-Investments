"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";
import { recordClientAudit } from "@/lib/data/audit";
import { requiredText } from "@/lib/validation";
import type { CalculatorType, Json } from "@/lib/supabase/types";

export type SaveState = { error?: string; savedId?: string };

const ENGINE_VERSION = "1.0";

/**
 * Save a calculation to a client, or to the advisor's own saved plans.
 *
 * Inputs, outputs AND assumptions are all stored. Storing only the inputs
 * would mean reopening the plan next year recalculated it against whatever
 * the firm's defaults had become — so what the client was shown would change
 * behind the advisor's back.
 */
export async function saveCalculation(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const profile = await requireProfile();

  const schema = z.object({
    title: requiredText("Title", 150),
    calculator_type: z.enum([
      "projection",
      "target_contribution",
      "required_lump_sum",
      "retirement",
      "dividend_income",
      "hajj",
      "affordability",
    ]),
    client_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid("Choose a valid client").nullable()),
    payload: z.string().min(2),
  });

  const parsed = schema.safeParse({
    title: formData.get("title") ?? "",
    calculator_type: formData.get("calculator_type") ?? "projection",
    client_id: formData.get("client_id") ?? "",
    payload: formData.get("payload") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  }

  let payload: { inputs: Json; outputs: Json; assumptions: Json };
  try {
    payload = JSON.parse(parsed.data.payload);
  } catch {
    return { error: "Could not read the calculation. Please run it again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_calculations")
    .insert({
      owner_id: profile.id,
      client_id: parsed.data.client_id,
      calculator_type: parsed.data.calculator_type as CalculatorType,
      title: parsed.data.title,
      inputs: payload.inputs,
      outputs: payload.outputs,
      assumptions: payload.assumptions,
      engine_version: ENGINE_VERSION,
    })
    .select("id")
    .single();

  if (error) return { error: `Could not save: ${error.message}` };

  if (parsed.data.client_id) {
    await recordClientAudit({
      clientId: parsed.data.client_id,
      actorId: profile.id,
      entityType: "saved_calculations",
      entityId: data.id,
      action: "save_calculation",
      after: { title: parsed.data.title, type: parsed.data.calculator_type },
    });
    revalidatePath(`/clients/${parsed.data.client_id}`);
  }

  revalidatePath("/saved");
  return { savedId: data.id };
}

export async function archiveSavedCalculation(id: string): Promise<void> {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("saved_calculations").update({ is_archived: true }).eq("id", id);
  revalidatePath("/saved");
}
