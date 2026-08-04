import "server-only";
import { z } from "zod";

/**
 * Server-only environment.
 *
 * The `server-only` import above is the guard: if any Client Component ever
 * imports this file (directly or through a chain of imports), the build fails
 * with an explicit error instead of quietly shipping the service-role key to
 * every browser that loads the app.
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security entirely. It is used
 * in exactly two places, both server-side:
 *   1. Admin user management (invite, activate, deactivate, set role)
 *   2. The scheduled fund-data refresh, which writes only to fund tables
 * It must never be used to read or write client data.
 */

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY looks too short to be valid"),
  /** Shared secret the scheduled refresh endpoint requires, so the job cannot
   *  be triggered by anyone who happens to find the URL. */
  FUND_REFRESH_SECRET: z
    .string()
    .min(16, "FUND_REFRESH_SECRET must be at least 16 characters"),
});

const parsed = serverSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FUND_REFRESH_SECRET: process.env.FUND_REFRESH_SECRET,
});

if (!parsed.success) {
  throw new Error(
    "Invalid server environment variables:\n" +
      parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
  );
}

export const serverEnv = parsed.data;
