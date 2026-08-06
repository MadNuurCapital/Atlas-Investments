import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PortfolioBuilder } from "./portfolio-builder";
import { listFunds } from "@/lib/data/funds";
import { listClients } from "@/lib/data/clients";
import { getScenarioRates } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Portfolio Builder" };

export default async function PortfolioBuilderPage() {
  const [funds, clients, rates] = await Promise.all([
    listFunds(),
    listClients(),
    getScenarioRates(),
  ]);

  return (
    <>
      <PageHeader
        title="Portfolio Builder"
        description="Build an illustrative portfolio of four to eight funds."
      />
      <PortfolioBuilder
        funds={funds.map((fund) => ({
          id: fund.id,
          name: fund.name,
          shareClass: fund.share_class,
          currency: fund.currency,
          category: fund.category,
          perf: {
            y1: fund.perf_1y,
            y3: fund.perf_3y,
            y5: fund.perf_5y,
          },
        }))}
        clients={clients.map((client) => ({ id: client.id, full_name: client.full_name }))}
        defaultRates={rates}
      />
    </>
  );
}
