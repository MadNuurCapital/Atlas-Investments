import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { NavChart } from "@/components/funds/nav-chart";
import { RefreshNowButton } from "../../data-health/refresh-button";
import { FundForm } from "../fund-form";
import { SourcePanel } from "./source-panel";
import { NavImportPanel } from "./nav-import-panel";
import { getFund } from "@/lib/data/funds";
import { importNavHistory, updateFund } from "../../actions";

export const metadata: Metadata = { title: "Manage fund" };

export default async function AdminFundPage({
  params,
}: PageProps<"/admin/funds/[id]">) {
  const { id } = await params;
  const fund = await getFund(id);
  if (!fund) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/funds"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to funds
        </Link>

        <div className="flex items-center gap-2">
          {fund.auto_refresh_enabled && <RefreshNowButton fundId={fund.id} />}
          <Link
            href={`/funds/${fund.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            View as advisor
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>

      <SourcePanel
        fundId={fund.id}
        fundName={`${fund.name} ${fund.share_class}`.trim()}
        currency={fund.currency}
        sourceIdentifier={fund.source_identifier}
        isVerified={fund.source_verified}
        autoRefreshEnabled={fund.auto_refresh_enabled}
      />

      <NavImportPanel
        action={importNavHistory.bind(null, fund.id)}
        existingCount={fund.navHistory.length}
      />

      {fund.navHistory.length > 0 && (
        <Card>
          <CardTitle>Stored history</CardTitle>
          <NavChart points={fund.navHistory} currency={fund.currency} />
        </Card>
      )}

      <FundForm action={updateFund.bind(null, fund.id)} fund={fund} />
    </div>
  );
}
