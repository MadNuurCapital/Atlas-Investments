"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { yahooProvider } from "@/lib/funds/yahoo";
import { parseNavImport } from "@/lib/funds/nav-import";
import { trailingReturn } from "@/lib/funds/nav-import";
import { refreshFunds } from "@/lib/funds/refresh";
import { publicEnv } from "@/lib/env";
import {
  fieldErrors,
  optionalDateField,
  optionalText,
  requiredText,
} from "@/lib/validation";
import type { FormState } from "../clients/actions";
import { PERF_KEYS, type PerfKey } from "@/lib/supabase/types";

/**
 * Administrative actions.
 *
 * Every one of these begins with requireAdmin(). That call is the
 * authorisation, not the hidden sidebar link — a non-admin who types the URL
 * or posts the form directly is refused here, and refused again by RLS.
 */

/* ------------------------------------------------------------------ funds */

const optionalFraction = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === "" || Number.isFinite(Number(v)),
      `${label} must be a number`,
    )
    .transform((v) => (v === "" ? null : Number(v) / 100))
    .refine(
      (v) => v === null || (v >= -1 && v <= 100),
      `${label} looks wrong — enter a percentage such as 5.2`,
    );

const fundSchema = z.object({
  name: requiredText("Fund name"),
  share_class: optionalText(80),
  isin: optionalText(20),
  fund_manager: optionalText(120),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "Currency must be a three-letter code such as SGD"),
  category: optionalText(80),
  risk_level: z
    .enum(["very_low", "low", "moderate", "moderately_high", "high", "very_high"])
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  shariah_status: z.enum(["shariah", "conventional", "unknown"]),
  distribution_type: z.enum(["accumulation", "distribution"]),
  distribution_frequency: z.enum([
    "none",
    "monthly",
    "quarterly",
    "semi_annual",
    "annual",
    "irregular",
  ]),
  description: optionalText(4000),
  factsheet_url: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https?:\/\//i.test(v),
      "Enter a full web address starting http:// or https://",
    )
    .transform((v) => (v === "" ? null : v)),
  inception_date: optionalDateField("Inception date"),
  source_identifier: optionalText(60),
  perf_ytd: optionalFraction("Year-to-date return"),
  perf_1m: optionalFraction("1 month return"),
  perf_6m: optionalFraction("6 month return"),
  perf_1y: optionalFraction("1 year return"),
  perf_3y: optionalFraction("3 year return"),
  perf_5y: optionalFraction("5 year return"),
  perf_since_inception: optionalFraction("Since inception return"),
});

/**
 * Which figures this submission claims as hand-entered.
 *
 * A filled box is a claim; an empty box releases it. That gives an obvious
 * way to hand a figure back to the automatic refresh — clear it and save —
 * without a second control to explain.
 *
 * Derived from the PARSED values rather than the raw form, so "0" is a claim
 * (zero is a real return) while whitespace is not.
 */
function claimedPerfKeys(parsed: z.infer<typeof fundSchema>): PerfKey[] {
  const byKey: Record<PerfKey, number | null> = {
    ytd: parsed.perf_ytd,
    "1m": parsed.perf_1m,
    "6m": parsed.perf_6m,
    "1y": parsed.perf_1y,
    "3y": parsed.perf_3y,
    "5y": parsed.perf_5y,
    since_inception: parsed.perf_since_inception,
  };
  return PERF_KEYS.filter((key) => byKey[key] !== null);
}

function readFundForm(formData: FormData) {
  const get = (key: string) => (formData.get(key) as string | null) ?? "";
  return {
    name: get("name"),
    share_class: get("share_class"),
    isin: get("isin"),
    fund_manager: get("fund_manager"),
    currency: get("currency") || "SGD",
    category: get("category"),
    risk_level: get("risk_level"),
    shariah_status: get("shariah_status") || "unknown",
    distribution_type: get("distribution_type") || "accumulation",
    distribution_frequency: get("distribution_frequency") || "none",
    description: get("description"),
    factsheet_url: get("factsheet_url"),
    inception_date: get("inception_date"),
    source_identifier: get("source_identifier"),
    perf_ytd: get("perf_ytd"),
    perf_1m: get("perf_1m"),
    perf_6m: get("perf_6m"),
    perf_1y: get("perf_1y"),
    perf_3y: get("perf_3y"),
    perf_5y: get("perf_5y"),
    perf_since_inception: get("perf_since_inception"),
  };
}

export async function createFund(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = fundSchema.safeParse(readFundForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funds")
    .insert({
      ...parsed.data,
      share_class: parsed.data.share_class ?? "",
      perf_manual_keys: claimedPerfKeys(parsed.data),
    })
    .select("id")
    .single();

  if (error) {
    // The unique index on (name, share class) is the common failure, and it
    // is doing its job: two records for one share class would let holdings
    // of the same thing drift apart.
    return {
      message: error.message.includes("funds_name_share_class_key")
        ? "A fund with this name and share class already exists."
        : `Could not save this fund: ${error.message}`,
    };
  }

  revalidatePath("/funds");
  redirect(`/admin/funds/${data.id}`);
}

export async function updateFund(
  fundId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = fundSchema.safeParse(readFundForm(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("funds")
    .update({
      ...parsed.data,
      share_class: parsed.data.share_class ?? "",
      perf_manual_keys: claimedPerfKeys(parsed.data),
    })
    .eq("id", fundId);

  if (error) return { message: `Could not save changes: ${error.message}` };

  revalidatePath("/funds");
  revalidatePath(`/funds/${fundId}`);
  return { ok: true, message: "Saved." };
}

/**
 * Fetch a symbol once and show what came back, WITHOUT storing anything.
 *
 * This is the guard against silently tracking the wrong share class. The
 * administrator sees the name and currency the source reports and decides
 * whether it really is the fund in front of them.
 */
export async function testFundSymbol(
  _prev: FormState & { preview?: string },
  formData: FormData,
): Promise<FormState & { preview?: string }> {
  await requireAdmin();

  const symbol = ((formData.get("source_identifier") as string) ?? "").trim();
  if (!symbol) return { message: "Enter a symbol to test." };

  const result = await yahooProvider.fetch(symbol);

  if (!result.ok) return { message: result.error };

  return {
    preview: JSON.stringify({
      name: result.quote.name,
      currency: result.quote.currency,
      nav: result.quote.nav,
      navDate: result.quote.navDate,
      history: result.history.length,
    }),
  };
}

/**
 * Confirm a symbol really is this fund's share class, and switch on
 * automatic refresh.
 *
 * A database constraint refuses auto_refresh_enabled without a verified
 * symbol, and a trigger clears verification if the symbol later changes —
 * so the badge can never outlive the thing it vouched for.
 */
export async function verifyFundSymbol(
  fundId: string,
  symbol: string,
  enableAutoRefresh: boolean,
): Promise<void> {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const trimmed = symbol.trim();
  if (!trimmed) return;

  // The symbol is stored in the SAME statement that verifies it. Testing a
  // symbol deliberately stores nothing, so verifying must persist the exact
  // string that was tested — otherwise the badge would vouch for whatever
  // happened to be in the column already.
  await supabase
    .from("funds")
    .update({
      source_identifier: trimmed,
      source_verified: true,
      source_verified_at: new Date().toISOString(),
      source_verified_by: profile.id,
      verification_status: "verified",
      data_source: "yahoo",
      auto_refresh_enabled: enableAutoRefresh,
    })
    .eq("id", fundId);

  await recordSystemAudit(profile.id, "funds", fundId, "verify_source_symbol");

  revalidatePath(`/admin/funds/${fundId}`);
  revalidatePath(`/funds/${fundId}`);
}

export async function archiveFund(
  fundId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireAdmin();

  const reason = requiredText("Reason", 500).safeParse(formData.get("reason") ?? "");
  if (!reason.success) return { errors: { reason: reason.error.issues[0].message } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("funds")
    .update({
      is_archived: true,
      archive_reason: reason.data,
      auto_refresh_enabled: false,
    })
    .eq("id", fundId);

  if (error) return { message: `Could not archive: ${error.message}` };

  await recordSystemAudit(profile.id, "funds", fundId, "archive_fund", reason.data);

  revalidatePath("/funds");
  redirect("/admin/funds");
}

/* ------------------------------------------------------------- NAV import */

export type ImportState = FormState & {
  summary?: { imported: number; skipped: number; errors: number; ambiguous: number };
};

export async function importNavHistory(
  fundId: string,
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const profile = await requireAdmin();

  const raw = ((formData.get("data") as string) ?? "").trim();
  if (!raw) return { message: "Paste some NAV history first." };

  const parsed = parseNavImport(raw);

  if (parsed.rows.length === 0) {
    return {
      message:
        parsed.errors.length > 0
          ? `Nothing could be read. First problem on line ${parsed.errors[0].line}: ${parsed.errors[0].reason}`
          : "Nothing could be read from that.",
    };
  }

  const supabase = await createClient();

  // Upsert so re-importing a corrected file replaces those dates rather than
  // failing, and never creates a second price for one day.
  const { error } = await supabase.from("fund_nav_history").upsert(
    parsed.rows.map((row) => ({
      fund_id: fundId,
      nav_date: row.date,
      nav: row.nav,
      source: "csv" as const,
      created_by: profile.id,
    })),
    { onConflict: "fund_id,nav_date" },
  );

  if (error) return { message: `Could not store the history: ${error.message}` };

  // Recompute the fund's headline figures from the full stored history, so
  // an imported fund reports performance the same way an automatic one does.
  const { data: history } = await supabase
    .from("fund_nav_history")
    .select("nav_date, nav")
    .eq("fund_id", fundId)
    .order("nav_date", { ascending: true });

  const points = (history ?? []).map((row) => ({
    date: row.nav_date,
    nav: Number(row.nav),
  }));
  const latest = points.at(-1);

  if (latest) {
    await supabase
      .from("funds")
      .update({
        latest_nav: latest.nav,
        nav_date: latest.date,
        perf_1m: trailingReturn(points, 1),
        perf_6m: trailingReturn(points, 6),
        perf_1y: trailingReturn(points, 12),
        perf_3y: trailingReturn(points, 36),
        perf_5y: trailingReturn(points, 60),
      })
      .eq("id", fundId);
  }

  await supabase.from("csv_import_jobs").insert({
    actor_id: profile.id,
    target: "fund_nav_history",
    fund_id: fundId,
    row_count: parsed.rows.length + parsed.errors.length,
    valid_count: parsed.rows.length,
    error_count: parsed.errors.length,
    errors: parsed.errors,
    status: "completed",
  });

  revalidatePath(`/funds/${fundId}`);
  revalidatePath(`/admin/funds/${fundId}`);

  return {
    summary: {
      imported: parsed.rows.length,
      skipped: parsed.duplicates,
      errors: parsed.errors.length,
      ambiguous: parsed.ambiguousDates,
    },
  };
}

/* ---------------------------------------------------------------- refresh */

export async function runRefreshNow(fundId?: string): Promise<void> {
  await requireAdmin();
  await refreshFunds({
    fundId,
    batchSize: 40,
    triggeredBy: "admin",
  });
  revalidatePath("/admin/data-health");
  if (fundId) revalidatePath(`/funds/${fundId}`);
}

/* ------------------------------------------------------------------ users */

const inviteSchema = z.object({
  email: z.email("Enter a valid email address"),
  full_name: requiredText("Full name"),
  role: z.enum(["advisor", "admin"]),
});

/**
 * Invite a user.
 *
 * There is no public sign-up anywhere in Atlas, so this is the only route to
 * an account. It uses the privileged client because creating an auth user
 * requires it — one of exactly two places that key is used, and it touches
 * no client data.
 */
export async function inviteUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireAdmin();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email") ?? "",
    full_name: formData.get("full_name") ?? "",
    role: formData.get("role") ?? "advisor",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name, role: parsed.data.role },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/accept-invite`,
  });

  if (error) {
    return {
      message: error.message.includes("already been registered")
        ? "That email address already has an Atlas account."
        : `Could not send the invitation: ${error.message}`,
    };
  }

  await recordSystemAudit(
    profile.id,
    "profiles",
    data.user?.id ?? null,
    "invite_user",
    `${parsed.data.email} as ${parsed.data.role}`,
  );

  revalidatePath("/admin/users");
  return { message: `Invitation sent to ${parsed.data.email}.` };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const profile = await requireAdmin();

  // The database trigger refuses this too. Checking here as well means the
  // admin gets a clear refusal rather than a raw constraint error.
  if (userId === profile.id) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);

  await recordSystemAudit(
    profile.id,
    "profiles",
    userId,
    isActive ? "activate_user" : "deactivate_user",
  );

  revalidatePath("/admin/users");
}

export async function setUserRole(
  userId: string,
  role: "advisor" | "admin",
): Promise<void> {
  const profile = await requireAdmin();
  if (userId === profile.id) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", userId);

  await recordSystemAudit(profile.id, "profiles", userId, `set_role_${role}`);
  revalidatePath("/admin/users");
}

/**
 * Correct another user's display name.
 *
 * Names are not identity here — the email is — so this is a typo fix, not a
 * privilege operation. It is still audited, because a client snapshot carries
 * the adviser's name and someone should be able to answer who changed it.
 *
 * Note what this action cannot do: `role` and `is_active` are not in the
 * update, and `protect_profile_fields()` would refuse them regardless.
 */
export async function setUserName(
  userId: string,
  _prev: FormState & { ok?: boolean },
  formData: FormData,
): Promise<FormState & { ok?: boolean }> {
  const profile = await requireAdmin();

  const parsed = requiredText("Name", 120).safeParse(formData.get("full_name") ?? "");
  if (!parsed.success) {
    return { errors: { full_name: parsed.error.issues[0].message } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data })
    .eq("id", userId);

  if (error) return { message: `Could not save that name: ${error.message}` };

  await recordSystemAudit(profile.id, "profiles", userId, "set_user_name");

  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
  return { ok: true, message: "Name updated." };
}

/* ------------------------------------------------------------------ audit */

async function recordSystemAudit(
  actorId: string,
  entityType: string,
  entityId: string | null,
  action: string,
  reason?: string,
): Promise<void> {
  try {
    // System-scope events are admin-readable. Client-scope events never are —
    // see src/lib/data/audit.ts for why that split matters.
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      scope: "system",
      actor_id: actorId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      reason: reason ?? null,
    });
  } catch (cause) {
    console.error("[audit] failed to record system event", cause);
  }
}
