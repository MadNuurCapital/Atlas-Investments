import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/types";

/**
 * Privileged Supabase client. BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Permitted uses — both server-side only:
 *   1. Admin user management: invite, activate, deactivate, assign role.
 *   2. The scheduled fund-data refresh, writing to fund tables and refresh logs.
 *
 * Forbidden use: reading or writing any client, holding, transaction, review,
 * snapshot, saved calculation or report. Those are protected by ownership
 * policies, and reaching around those policies with this client would defeat
 * the entire privacy model of the product — including the guarantee that an
 * Admin cannot browse another advisor's client book.
 *
 * Every call site must first verify the caller's identity and role using the
 * ordinary user-scoped client. Holding this key is not authorisation.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
