import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";
import { CALCULATOR_NAMES } from "@/lib/calculators/registry";
import { formatSgDate } from "@/lib/format";
import type { CalculatorType } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Saved Plans" };

export default async function SavedPage() {
  await requireProfile();
  const supabase = await createClient();

  // RLS returns only this advisor's own saved work, and only where any
  // attached client is still theirs.
  const { data: saved } = await supabase
    .from("saved_calculations")
    .select("*, clients(id, full_name)")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const rows = saved ?? [];

  return (
    <>
      <PageHeader
        title="Saved Plans"
        description="Your saved calculations. Each one reproduces the exact figures and assumptions it was saved with."
        action={
          <Link href="/calculators" className={buttonVariants()}>
            <Calculator className="size-4" />
            Open a calculator
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Run a calculation and save it, optionally against a client, and it will appear here."
          action={
            <Link href="/calculators" className={buttonVariants()}>
              Open a calculator
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Calculator</TH>
              <TH>Client</TH>
              <TH>Saved</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => {
              const client = row.clients as { id: string; full_name: string } | null;
              return (
                <TR key={row.id}>
                  <TD>
                    <span className="font-medium text-foreground">{row.title}</span>
                  </TD>
                  <TD>
                    <Badge tone="info">
                      {CALCULATOR_NAMES[row.calculator_type as CalculatorType] ??
                        row.calculator_type}
                    </Badge>
                  </TD>
                  <TD>
                    {client ? (
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-sm text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
                      >
                        {client.full_name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not attached</span>
                    )}
                  </TD>
                  <TD>{formatSgDate(row.created_at)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Inputs, outputs and the assumptions in force are all stored together.
        Reopening a plan next year shows exactly what the client was shown, not
        a recalculation against today&apos;s defaults.
      </p>
    </>
  );
}
