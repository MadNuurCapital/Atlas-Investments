import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/data/clients";
import { createHolding, updateHolding } from "../../actions";
import { HoldingsPanel, type HoldingRow } from "./holdings-panel";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage({
  params,
}: PageProps<"/clients/[id]/investments">) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  // Server Actions are bound to this client id here, so the id never travels
  // through a form field where it could be swapped for another advisor's.
  // RLS would reject that anyway, but the id has no business being editable.
  const create = createHolding.bind(null, id);
  const update = updateHolding.bind(null, id);

  const rows: HoldingRow[] = client.holdings.map((holding) => ({
    ...holding,
    fundDisplayName: holding.fundDisplayName,
    totals: {
      totalContributed: holding.totals.totalContributed,
      adjustedValue: holding.totals.adjustedValue,
      gainLoss: holding.totals.gainLoss,
      gainLossFraction: holding.totals.gainLossFraction,
      monthlyContributionNow: holding.totals.monthlyContributionNow,
      dividends: holding.totals.dividends,
      withdrawals: holding.totals.withdrawals,
      isOverridden: holding.totals.isOverridden,
      contributionsPaid: holding.totals.contributionsPaid,
    },
  }));

  return <HoldingsPanel holdings={rows} createAction={create} updateAction={update} />;
}
