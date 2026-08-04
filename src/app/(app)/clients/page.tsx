import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { listClients } from "@/lib/data/clients";
import { getReminder } from "@/lib/reviews/reminders";
import { formatSgDate, formatSgd, NOT_AVAILABLE } from "@/lib/format";

export const metadata: Metadata = { title: "Clients" };

const REMINDER_TONE = {
  overdue: "negative",
  due_7: "warning",
  due_14: "warning",
  due_30: "info",
  scheduled: "neutral",
  none: "neutral",
} as const;

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const showArchived = params.archived === "1";

  const clients = await listClients({ search, includeArchived: showArchived });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Only clients assigned to you are visible here."
        action={
          <Link href="/clients/new" className={buttonVariants()}>
            <Plus className="size-4" />
            Add client
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-3" role="search">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search by name, email or phone"
            aria-label="Search clients"
            className="pl-9"
          />
        </div>
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <Link
          href={showArchived ? "/clients" : "/clients?archived=1"}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          title={search ? "No clients match that search" : "No clients yet"}
          description={
            search
              ? "Try a different name, email address or phone number."
              : "Add your first client to start tracking investments and reviews."
          }
          action={
            !search ? (
              <Link href="/clients/new" className={buttonVariants()}>
                Add client
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Next review</TH>
              <TH numeric>Holdings</TH>
              <TH numeric>Current value</TH>
              <TH numeric>Monthly</TH>
              <TH numeric>Dividends</TH>
            </TR>
          </THead>
          <TBody>
            {clients.map((client) => {
              const reminder = getReminder(
                client.next_review_date,
                client.reminder_snoozed_until,
              );
              return (
                <TR key={client.id}>
                  <TD>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                    >
                      {client.full_name}
                    </Link>
                    {client.status === "archived" && (
                      <Badge className="ml-2">Archived</Badge>
                    )}
                    {client.email && (
                      <p className="text-xs text-muted-foreground">{client.email}</p>
                    )}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Badge tone={REMINDER_TONE[reminder.bucket]}>
                        {reminder.label}
                      </Badge>
                      {reminder.isSnoozed && (
                        <span className="text-xs text-subtle-foreground">snoozed</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatSgDate(client.next_review_date)}
                    </p>
                  </TD>
                  <TD numeric>{client.holdingCount}</TD>
                  <TD numeric>
                    {formatSgd(client.portfolio.adjustedValue)}
                    {client.portfolio.unvaluedCount > 0 && (
                      <p className="text-xs font-normal text-[var(--warning)]">
                        {client.portfolio.unvaluedCount} not valued
                      </p>
                    )}
                  </TD>
                  <TD numeric>{formatSgd(client.portfolio.monthlyContribution)}</TD>
                  <TD numeric>
                    {client.portfolio.dividends > 0
                      ? formatSgd(client.portfolio.dividends)
                      : NOT_AVAILABLE}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
