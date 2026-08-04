import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/data/clients";
import { listClientAudit } from "@/lib/data/audit";
import { EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatSgDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "History" };

const ACTION_LABELS: Record<string, string> = {
  create_holding: "Holding added",
  update_holding: "Holding edited",
  update_current_value: "Current value updated",
  archive_holding: "Holding archived",
  archive_client: "Client archived",
  restore_client: "Client restored",
  record_additional_lump_sum: "Additional lump sum recorded",
  record_withdrawal: "Withdrawal recorded",
  record_dividend: "Dividend recorded",
  record_contribution_change: "Contribution change recorded",
  record_adjustment: "Adjustment recorded",
  delete_transaction: "Transaction removed",
  complete_review: "Review completed",
  correct_review: "Review corrected",
};

export default async function HistoryPage({
  params,
}: PageProps<"/clients/[id]/history">) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const events = await listClientAudit(id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A record of changes to the figures a client could later ask about.
        Visible only to you — administrators cannot read this trail, because a
        log of changes to a client&apos;s values is itself client information.
      </p>

      {events.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Changes to values, contributions, withdrawals, dividends and reviews appear here."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Change</TH>
              <TH>By</TH>
              <TH>Reason</TH>
            </TR>
          </THead>
          <TBody>
            {events.map((event) => (
              <TR key={event.id}>
                <TD>
                  <span className="whitespace-nowrap text-sm">
                    {formatSgDateTime(event.created_at)}
                  </span>
                </TD>
                <TD>
                  {ACTION_LABELS[event.action] ?? event.action.replace(/_/g, " ")}
                </TD>
                <TD>
                  <span className="text-sm text-muted-foreground">
                    {(event.profiles as { full_name?: string } | null)?.full_name ??
                      "—"}
                  </span>
                </TD>
                <TD>
                  <span className="text-sm text-muted-foreground">
                    {event.reason ?? ""}
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
