"use client";

import { useState } from "react";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { HoldingForm } from "./holding-form";
import type { FormState } from "../../actions";
import type { ClientHolding, HoldingStatus } from "@/lib/supabase/types";
import {
  formatPercent,
  formatSgDate,
  formatSgd,
  formatSignedSgd,
} from "@/lib/format";

const STATUS_TONE: Record<HoldingStatus, "positive" | "warning" | "neutral"> = {
  active: "positive",
  paused: "warning",
  matured: "neutral",
  closed: "neutral",
  lapsed: "warning",
};

const HEADLINE: HoldingStatus[] = ["active", "paused"];

export type HoldingRow = ClientHolding & {
  fundDisplayName: string;
  totals: {
    totalContributed: number;
    adjustedValue: number | null;
    gainLoss: number | null;
    gainLossFraction: number | null;
    monthlyContributionNow: number;
    dividends: number;
    withdrawals: number;
    isOverridden: boolean;
    contributionsPaid: number;
  };
};

export function HoldingsPanel({
  holdings,
  createAction,
  updateAction,
}: {
  holdings: HoldingRow[];
  createAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  updateAction: (
    holdingId: string,
    prev: FormState,
    formData: FormData,
  ) => Promise<FormState>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const current = holdings.filter((h) => HEADLINE.includes(h.status));
  const finished = holdings.filter((h) => !HEADLINE.includes(h.status));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setAdding((open) => !open)} variant={adding ? "secondary" : "primary"}>
          <Plus className="size-4" />
          {adding ? "Close" : "Add holding"}
        </Button>
      </div>

      {adding && (
        <Card>
          <CardTitle>New holding</CardTitle>
          <HoldingForm
            action={createAction}
            onDone={() => setAdding(false)}
            submitLabel="Add holding"
          />
        </Card>
      )}

      {holdings.length === 0 && !adding ? (
        <EmptyState
          title="No holdings recorded"
          description="Add this client's investments to track contributions, value and gain over time."
          action={<Button onClick={() => setAdding(true)}>Add holding</Button>}
        />
      ) : (
        <>
          {current.length > 0 && <HoldingTable rows={current} onEdit={setEditingId} />}

          {finished.length > 0 && (
            <details className="rounded-lg border border-[var(--border)] bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground">
                <ChevronDown className="size-4" />
                Closed, matured and lapsed holdings ({finished.length})
                <span className="ml-auto text-xs font-normal">
                  Excluded from headline totals
                </span>
              </summary>
              <div className="border-t border-[var(--border)] p-4">
                <HoldingTable rows={finished} onEdit={setEditingId} />
              </div>
            </details>
          )}
        </>
      )}

      {editingId && (
        <Card>
          <CardTitle>
            Edit holding —{" "}
            {holdings.find((h) => h.id === editingId)?.product_name ?? ""}
          </CardTitle>
          <HoldingForm
            action={updateAction.bind(null, editingId)}
            holding={holdings.find((h) => h.id === editingId)}
            onDone={() => setEditingId(null)}
          />
        </Card>
      )}
    </div>
  );
}

function HoldingTable({
  rows,
  onEdit,
}: {
  rows: HoldingRow[];
  onEdit: (id: string) => void;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Holding</TH>
          <TH>Status</TH>
          <TH numeric>Contributed</TH>
          <TH numeric>Current value</TH>
          <TH numeric>Gain / loss</TH>
          <TH numeric>Monthly</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {rows.map((holding) => (
          <TR key={holding.id}>
            <TD>
              <p className="font-medium text-foreground">{holding.product_name}</p>
              <p className="text-xs text-muted-foreground">
                {holding.provider} · {holding.fundDisplayName}
              </p>
              {!holding.fund_id && (
                <Badge tone="neutral" className="mt-1">
                  Unlinked fund
                </Badge>
              )}
            </TD>
            <TD>
              <Badge tone={STATUS_TONE[holding.status]} className="capitalize">
                {holding.status}
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                Since {formatSgDate(holding.start_date)}
              </p>
            </TD>
            <TD numeric>
              {formatSgd(holding.totals.totalContributed)}
              <p className="text-xs font-normal text-muted-foreground">
                {holding.totals.isOverridden
                  ? "Manually overridden"
                  : `${holding.totals.contributionsPaid} payments`}
              </p>
            </TD>
            <TD numeric>
              {formatSgd(holding.totals.adjustedValue)}
              {holding.current_value_as_of && (
                <p className="text-xs font-normal text-muted-foreground">
                  as at {formatSgDate(holding.current_value_as_of)}
                </p>
              )}
            </TD>
            <TD numeric>
              <span
                className={
                  holding.totals.gainLoss === null
                    ? "text-subtle-foreground"
                    : holding.totals.gainLoss > 0
                      ? "text-[var(--positive)]"
                      : holding.totals.gainLoss < 0
                        ? "text-[var(--negative)]"
                        : ""
                }
              >
                {formatSignedSgd(holding.totals.gainLoss)}
              </span>
              <p className="text-xs font-normal text-muted-foreground">
                {formatPercent(holding.totals.gainLossFraction, { signed: true })}
              </p>
            </TD>
            <TD numeric>{formatSgd(holding.totals.monthlyContributionNow)}</TD>
            <TD>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(holding.id)}
                aria-label={`Edit ${holding.product_name}`}
              >
                <Pencil className="size-4" />
              </Button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
