import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getClient } from "@/lib/data/clients";
import { getReminder } from "@/lib/reviews/reminders";
import { Badge } from "@/components/ui/card";
import { formatSgDate } from "@/lib/format";
import { ClientTabs } from "./client-tabs";

const REMINDER_TONE = {
  overdue: "negative",
  due_7: "warning",
  due_14: "warning",
  due_30: "info",
  scheduled: "neutral",
  none: "neutral",
} as const;

export default async function ClientLayout({
  children,
  params,
}: LayoutProps<"/clients/[id]">) {
  const { id } = await params;
  const client = await getClient(id);

  // A client belonging to another advisor and a client that does not exist
  // are the same response. Confirming a record exists is itself a disclosure.
  if (!client) notFound();

  const reminder = getReminder(client.next_review_date, client.reminder_snoozed_until);

  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to clients
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {client.full_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[client.email, client.phone].filter(Boolean).join(" · ") ||
              "No contact details recorded"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {client.status === "archived" && <Badge>Archived</Badge>}
          <Badge tone={REMINDER_TONE[reminder.bucket]}>{reminder.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {formatSgDate(client.next_review_date)}
          </span>
        </div>
      </div>

      <ClientTabs clientId={id} />

      <div className="mt-6">{children}</div>
    </>
  );
}
