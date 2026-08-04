import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DataHealthBadge } from "@/components/funds/fund-badges";
import { listFunds } from "@/lib/data/funds";
import { formatCurrency, formatSgDate } from "@/lib/format";

export const metadata: Metadata = { title: "Manage funds" };

export default async function AdminFundsPage() {
  const funds = await listFunds({ includeArchived: true });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/admin/funds/new" className={buttonVariants()}>
          <Plus className="size-4" />
          Add fund
        </Link>
      </div>

      {funds.length === 0 ? (
        <EmptyState
          title="No funds yet"
          description="Add funds one at a time from a factsheet, then paste their NAV history in bulk. A fund with no automatic source is fully supported."
          action={
            <Link href="/admin/funds/new" className={buttonVariants()}>
              Add the first fund
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Fund</TH>
              <TH>Source</TH>
              <TH numeric>Latest NAV</TH>
              <TH>Data</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {funds.map((fund) => (
              <TR key={fund.id} className={fund.is_archived ? "opacity-60" : undefined}>
                <TD>
                  <span className="font-medium text-foreground">{fund.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {[fund.share_class, fund.isin].filter(Boolean).join(" · ") || "—"}
                  </p>
                </TD>
                <TD>
                  <span className="text-sm capitalize text-muted-foreground">
                    {fund.data_source === "yahoo" ? "Yahoo Finance" : fund.data_source}
                  </span>
                  {fund.data_source === "yahoo" && (
                    <p className="text-xs">
                      {fund.source_verified ? (
                        fund.auto_refresh_enabled ? (
                          <span className="text-[var(--positive)]">
                            verified · auto-refresh on
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            verified · auto-refresh off
                          </span>
                        )
                      ) : (
                        <span className="text-[var(--warning)]">not verified</span>
                      )}
                    </p>
                  )}
                </TD>
                <TD numeric>
                  {formatCurrency(fund.latest_nav, fund.currency)}
                  <p className="text-xs font-normal text-muted-foreground">
                    {formatSgDate(fund.nav_date)}
                  </p>
                </TD>
                <TD>
                  <DataHealthBadge health={fund.health} />
                </TD>
                <TD>
                  <Link
                    href={`/admin/funds/${fund.id}`}
                    className="text-sm font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                  >
                    Manage
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
