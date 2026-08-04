import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

/**
 * Audit trail for the figures a client could later dispute.
 *
 * Scope is a security boundary, not a label:
 *
 *   'client' — current values, contributions, withdrawals, dividends,
 *              review corrections. Readable ONLY by the owning advisor,
 *              because a log saying "value changed on client X" IS client
 *              data. Admins cannot read these.
 *
 *   'system' — users, roles, funds, settings. Admin-readable.
 *
 * Recording is best-effort by design. If writing the audit row fails, the
 * user's actual work must not be rolled back — losing a client's updated
 * portfolio value to protect a log entry is the wrong trade. Failures are
 * logged server-side for investigation.
 */

export type ClientAuditInput = {
  clientId: string;
  actorId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  before?: Json | null;
  after?: Json | null;
  reason?: string | null;
};

export async function recordClientAudit(input: ClientAuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_events").insert({
      scope: "client",
      client_id: input.clientId,
      actor_id: input.actorId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? null,
    });
    if (error) {
      console.error("[audit] failed to record client event", {
        action: input.action,
        entityType: input.entityType,
        message: error.message,
      });
    }
  } catch (cause) {
    console.error("[audit] threw while recording client event", cause);
  }
}

export async function listClientAudit(clientId: string, limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("*, profiles(full_name)")
    .eq("scope", "client")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load audit trail: ${error.message}`);
  return data ?? [];
}
