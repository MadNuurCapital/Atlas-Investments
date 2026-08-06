"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";
import { recordClientAudit } from "@/lib/data/audit";
import {
  dateField,
  fieldErrors,
  moneyField,
  optionalDateField,
  optionalMoneyField,
  optionalText,
  requiredText,
} from "@/lib/validation";
import { toISODate, addMonths, parseDate } from "@/lib/calc/dates";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  /**
   * Whether `message` reports success.
   *
   * Server actions carry one message field for both outcomes, and without
   * this every form had to guess. They guessed differently: the fund form
   * rendered "Saved." in alarm red, while the client form silently swallowed
   * it and gave no confirmation at all. Set it on every message and render
   * through `FormNotice`, which reads it.
   */
  ok?: boolean;
};

/* ---------------------------------------------------------------- clients */

const clientSchema = z.object({
  full_name: requiredText("Client name"),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Enter a valid email address").nullable()),
  phone: optionalText(50),
  notes: optionalText(5000),
  next_review_date: optionalDateField("Next review date"),
});

export async function createClientRecord(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = clientSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
    next_review_date: formData.get("next_review_date") ?? "",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      // Ownership is set from the authenticated session, never from the form.
      // The RLS policy independently rejects any other value.
      advisor_id: profile.id,
      ...parsed.data,
      // A client with no review date would never appear in a reminder bucket.
      next_review_date:
        parsed.data.next_review_date ?? toISODate(addMonths(new Date(), 3)),
    })
    .select("id")
    .single();

  if (error) return { message: `Could not save this client: ${error.message}` };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect(`/clients/${data.id}`);
}

export async function updateClientRecord(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();

  const parsed = clientSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
    next_review_date: formData.get("next_review_date") ?? "",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", clientId);

  if (error) return { message: `Could not save changes: ${error.message}` };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true, message: "Saved." };
}

const archiveSchema = z.object({
  reason: requiredText("Reason", 500),
});

export async function archiveClient(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = archiveSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archive_reason: parsed.data.reason,
    })
    .eq("id", clientId);

  if (error) return { message: `Could not archive: ${error.message}` };

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "clients",
    entityId: clientId,
    action: "archive_client",
    reason: parsed.data.reason,
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function restoreClient(clientId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("clients")
    .update({ status: "active", archived_at: null, archive_reason: null })
    .eq("id", clientId);

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "clients",
    entityId: clientId,
    action: "restore_client",
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

/* --------------------------------------------------------------- holdings */

const holdingSchema = z
  .object({
    provider: requiredText("Provider"),
    product_name: requiredText("Product name"),
    fund_name_manual: optionalText(200),
    policy_reference: optionalText(100),
    initial_lump_sum: moneyField("Initial lump sum"),
    monthly_contribution: moneyField("Monthly contribution"),
    start_date: dateField("Start date"),
    current_value: optionalMoneyField("Current value"),
    current_value_as_of: optionalDateField("Value date"),
    investment_goal: optionalText(500),
    status: z.enum(["active", "paused", "matured", "closed", "lapsed"]),
    contributions_ceased_on: optionalDateField("Contributions ceased on"),
  })
  .refine((v) => v.current_value === null || v.current_value_as_of !== null, {
    message: "Give the date this value was accurate",
    path: ["current_value_as_of"],
  })
  .refine((v) => v.status === "active" || v.contributions_ceased_on !== null, {
    message: "Give the date contributions stopped",
    path: ["contributions_ceased_on"],
  })
  .refine(
    (v) =>
      v.contributions_ceased_on === null ||
      parseDate(v.contributions_ceased_on) >= parseDate(v.start_date),
    {
      message: "Contributions cannot stop before the holding started",
      path: ["contributions_ceased_on"],
    },
  )
  .refine((v) => v.initial_lump_sum > 0 || v.monthly_contribution > 0, {
    message: "A holding needs either a lump sum or a monthly contribution",
    path: ["initial_lump_sum"],
  });

function readHoldingForm(formData: FormData) {
  return {
    provider: formData.get("provider") ?? "",
    product_name: formData.get("product_name") ?? "",
    fund_name_manual: formData.get("fund_name_manual") ?? "",
    policy_reference: formData.get("policy_reference") ?? "",
    initial_lump_sum: formData.get("initial_lump_sum") ?? "0",
    monthly_contribution: formData.get("monthly_contribution") ?? "0",
    start_date: formData.get("start_date") ?? "",
    current_value: formData.get("current_value") ?? "",
    current_value_as_of: formData.get("current_value_as_of") ?? "",
    investment_goal: formData.get("investment_goal") ?? "",
    status: formData.get("status") ?? "active",
    contributions_ceased_on: formData.get("contributions_ceased_on") ?? "",
  };
}

export async function createHolding(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = holdingSchema.safeParse(readHoldingForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_holdings")
    .insert({ client_id: clientId, ...parsed.data });

  if (error) return { message: `Could not save this holding: ${error.message}` };

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "client_holdings",
    action: "create_holding",
    after: parsed.data,
  });

  revalidatePath(`/clients/${clientId}`);
  return { message: "Holding added." };
}

export async function updateHolding(
  clientId: string,
  holdingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = holdingSchema.safeParse(readHoldingForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();

  // Capture the previous state so the audit trail records what changed, not
  // merely that something did.
  const { data: before } = await supabase
    .from("client_holdings")
    .select("current_value, monthly_contribution, status, contributed_override")
    .eq("id", holdingId)
    .maybeSingle();

  const { error } = await supabase
    .from("client_holdings")
    .update(parsed.data)
    .eq("id", holdingId);

  if (error) return { message: `Could not save changes: ${error.message}` };

  const valueChanged =
    before && Number(before.current_value ?? 0) !== (parsed.data.current_value ?? 0);

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "client_holdings",
    entityId: holdingId,
    action: valueChanged ? "update_current_value" : "update_holding",
    before: before ?? null,
    after: {
      current_value: parsed.data.current_value,
      monthly_contribution: parsed.data.monthly_contribution,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Saved." };
}

export async function archiveHolding(
  clientId: string,
  holdingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = archiveSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_holdings")
    .update({
      archived_at: new Date().toISOString(),
      archive_reason: parsed.data.reason,
    })
    .eq("id", holdingId);

  if (error) return { message: `Could not archive: ${error.message}` };

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "client_holdings",
    entityId: holdingId,
    action: "archive_holding",
    reason: parsed.data.reason,
  });

  revalidatePath(`/clients/${clientId}`);
  return { message: "Holding archived." };
}

/* ----------------------------------------------------------- transactions */

const transactionSchema = z
  .object({
    holding_id: z.uuid("Choose a holding"),
    type: z.enum([
      "additional_lump_sum",
      "withdrawal",
      "dividend",
      "contribution_change",
      "adjustment",
    ]),
    amount: optionalMoneyField("Amount"),
    new_monthly_amount: optionalMoneyField("New monthly amount"),
    effective_date: dateField("Date"),
    notes: optionalText(1000),
  })
  .refine(
    (v) =>
      v.type === "contribution_change"
        ? v.new_monthly_amount !== null
        : v.amount !== null,
    {
      message: "Enter an amount",
      path: ["amount"],
    },
  );

export async function recordTransaction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();

  const parsed = transactionSchema.safeParse({
    holding_id: formData.get("holding_id") ?? "",
    type: formData.get("type") ?? "dividend",
    amount: formData.get("amount") ?? "",
    new_monthly_amount: formData.get("new_monthly_amount") ?? "",
    effective_date: formData.get("effective_date") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const isChange = parsed.data.type === "contribution_change";
  const supabase = await createClient();

  const { error } = await supabase.from("holding_transactions").insert({
    holding_id: parsed.data.holding_id,
    type: parsed.data.type,
    // The database constraint requires exactly one of these, matching type.
    amount: isChange ? null : parsed.data.amount,
    new_monthly_amount: isChange ? parsed.data.new_monthly_amount : null,
    effective_date: parsed.data.effective_date,
    notes: parsed.data.notes,
    created_by: profile.id,
  });

  if (error) return { message: `Could not record this: ${error.message}` };

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "holding_transactions",
    entityId: parsed.data.holding_id,
    action: `record_${parsed.data.type}`,
    after: {
      amount: parsed.data.amount,
      new_monthly_amount: parsed.data.new_monthly_amount,
      effective_date: parsed.data.effective_date,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { message: "Recorded." };
}

export async function deleteTransaction(
  clientId: string,
  transactionId: string,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("holding_transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();

  await supabase.from("holding_transactions").delete().eq("id", transactionId);

  await recordClientAudit({
    clientId,
    actorId: profile.id,
    entityType: "holding_transactions",
    entityId: transactionId,
    action: "delete_transaction",
    before: before ?? null,
  });

  revalidatePath(`/clients/${clientId}`);
}
