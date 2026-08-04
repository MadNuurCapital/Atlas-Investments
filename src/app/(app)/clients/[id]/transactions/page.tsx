import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClient, listClientTransactions } from "@/lib/data/clients";
import { recordTransaction } from "../../actions";
import { TransactionsPanel, type TransactionRow } from "./transactions-panel";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({
  params,
}: PageProps<"/clients/[id]/transactions">) {
  const { id } = await params;
  const [client, transactions] = await Promise.all([
    getClient(id),
    listClientTransactions(id),
  ]);

  if (!client) notFound();

  return (
    <TransactionsPanel
      transactions={transactions as unknown as TransactionRow[]}
      holdings={client.holdings.map((h) => ({
        id: h.id,
        provider: h.provider,
        product_name: h.product_name,
      }))}
      action={recordTransaction.bind(null, id)}
    />
  );
}
