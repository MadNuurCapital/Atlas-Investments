import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CompareWorkspace } from "./compare-workspace";
import { listFunds } from "@/lib/data/funds";

export const metadata: Metadata = { title: "Compare Funds" };

export default async function ComparePage() {
  const funds = await listFunds();

  return (
    <>
      <PageHeader
        title="Compare Funds"
        description="Up to three funds side by side."
      />
      <CompareWorkspace
        funds={funds.map((fund) => ({
          id: fund.id,
          name: fund.name,
          shareClass: fund.share_class,
          manager: fund.fund_manager,
          currency: fund.currency,
          category: fund.category,
          riskLevel: fund.risk_level,
          shariahStatus: fund.shariah_status,
          distributionType: fund.distribution_type,
          distributionFrequency: fund.distribution_frequency,
          latestNav: fund.latest_nav,
          navDate: fund.nav_date,
          health: fund.health,
          perf: {
            m1: fund.perf_1m,
            m6: fund.perf_6m,
            y1: fund.perf_1y,
            y3: fund.perf_3y,
            y5: fund.perf_5y,
            inception: fund.perf_since_inception,
          },
        }))}
      />
    </>
  );
}
