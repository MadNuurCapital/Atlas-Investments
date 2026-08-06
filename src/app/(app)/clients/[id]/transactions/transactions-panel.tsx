"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, EmptyState, FormNotice } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatSgDate, formatSgd } from "@/lib/format";
import type { FormState } from "../../actions";
import type { TransactionType } from "@/lib/supabase/types";

const TYPES: { value: TransactionType; label: string; tone: "positive" | "negative" | "info" | "neutral" }[] = [
  { value: "additional_lump_sum", label: "Additional lump sum", tone: "positive" },
  { value: "withdrawal", label: "Withdrawal", tone: "negative" },
  { value: "dividend", label: "Dividend / distribution", tone: "info" },
  { value: "contribution_change", label: "Contribution change", tone: "neutral" },
  { value: "adjustment", label: "Adjustment", tone: "neutral" },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));
const TYPE_TONE = Object.fromEntries(TYPES.map((t) => [t.value, t.tone]));

export type TransactionRow = {
  id: string;
  type: TransactionType;
  amount: number | null;
  new_monthly_amount: number | null;
  effective_date: string;
  notes: string | null;
  client_holdings: { id: string; provider: string; product_name: string } | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Recording…" : "Record"}
    </Button>
  );
}

export function TransactionsPanel({
  transactions,
  holdings,
  action,
}: {
  transactions: TransactionRow[];
  holdings: { id: string; provider: string; product_name: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("dividend");
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  const isChange = type === "contribution_change";

  if (holdings.length === 0) {
    return (
      <EmptyState
        title="No holdings to record against"
        description="Add a holding on the Investments tab first — transactions belong to a holding."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setOpen((o) => !o)} variant={open ? "secondary" : "primary"}>
          <Plus className="size-4" />
          {open ? "Close" : "Record transaction"}
        </Button>
      </div>

      {open && (
        <Card>
          <CardTitle>Record a transaction</CardTitle>
          <form action={formAction} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Holding" htmlFor="holding_id" required error={state.errors?.holding_id}>
                <Select id="holding_id" name="holding_id" required>
                  {holdings.map((holding) => (
                    <option key={holding.id} value={holding.id}>
                      {holding.provider} — {holding.product_name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Type" htmlFor="type" required>
                <Select
                  id="type"
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as TransactionType)}
                >
                  {TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {isChange ? (
                <Field
                  label="New monthly amount"
                  htmlFor="new_monthly_amount"
                  required
                  hint="Enter 0 to record that contributions have stopped."
                  error={state.errors?.amount ?? state.errors?.new_monthly_amount}
                >
                  <MoneyInput id="new_monthly_amount" name="new_monthly_amount" required />
                </Field>
              ) : (
                <Field
                  label="Amount"
                  htmlFor="amount"
                  required
                  hint="Always a positive figure — the type says which direction it went."
                  error={state.errors?.amount}
                >
                  <MoneyInput id="amount" name="amount" required />
                </Field>
              )}

              <Field
                label="Date"
                htmlFor="effective_date"
                required
                error={state.errors?.effective_date}
              >
                <Input id="effective_date" name="effective_date" type="date" required />
              </Field>
            </div>

            <Field label="Notes" htmlFor="notes" error={state.errors?.notes}>
              <Textarea id="notes" name="notes" rows={2} />
            </Field>

            <FormNotice message={state.message} ok={state.ok} />
            {state.message && !state.errors && (
              <p className="text-sm text-[var(--positive)]" role="status">
                {state.message}
              </p>
            )}

            <Submit />
          </form>
        </Card>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          title="No transactions recorded"
          description="Record additional lump sums, withdrawals, dividends and contribution changes here."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Holding</TH>
              <TH numeric>Amount</TH>
              <TH>Notes</TH>
            </TR>
          </THead>
          <TBody>
            {transactions.map((transaction) => (
              <TR key={transaction.id}>
                <TD>{formatSgDate(transaction.effective_date)}</TD>
                <TD>
                  <Badge tone={TYPE_TONE[transaction.type] as "positive"}>
                    {TYPE_LABEL[transaction.type]}
                  </Badge>
                </TD>
                <TD>
                  <span className="text-sm text-muted-foreground">
                    {transaction.client_holdings?.product_name ?? "—"}
                  </span>
                </TD>
                <TD numeric>
                  {transaction.type === "contribution_change"
                    ? `${formatSgd(transaction.new_monthly_amount)} / month`
                    : formatSgd(transaction.amount)}
                </TD>
                <TD>
                  <span className="text-sm text-muted-foreground">
                    {transaction.notes ?? ""}
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
