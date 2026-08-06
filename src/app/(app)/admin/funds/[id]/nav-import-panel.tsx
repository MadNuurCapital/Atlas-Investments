"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, FormNotice } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import type { ImportState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Importing…" : "Import history"}
    </Button>
  );
}

export function NavImportPanel({
  action,
  existingCount,
}: {
  action: (prev: ImportState, formData: FormData) => Promise<ImportState>;
  existingCount: number;
}) {
  const [state, formAction] = useActionState<ImportState, FormData>(action, {});

  return (
    <Card>
      <CardTitle>NAV history</CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        {existingCount === 0
          ? "No history recorded yet — the chart will say so rather than drawing a line from nothing."
          : `${existingCount} prices recorded.`}{" "}
        Paste a date and NAV per line, copied straight from a factsheet,
        provider portal or spreadsheet. Commas, tabs and semicolons all work,
        a header row is ignored, and dates may be
        <code className="mx-1">2026-08-04</code>,
        <code className="mx-1">04/08/2026</code> or
        <code className="mx-1">04-Aug-2026</code>. Re-importing a date replaces
        it rather than duplicating it.
      </p>

      <form action={formAction} className="space-y-4">
        <Field label="Paste NAV history" htmlFor="data">
          <Textarea
            id="data"
            name="data"
            rows={8}
            className="font-mono text-xs"
            placeholder={"Date,NAV\n2026-06-30,1.2345\n2026-07-31,1.2500\n2026-08-31,1.2410"}
          />
        </Field>

        <FormNotice message={state.message} ok={state.ok} />

        {state.summary && (
          <div
            role="status"
            className="rounded-md bg-[var(--positive-surface)] p-3 text-sm"
          >
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="size-4 text-[var(--positive)]" />
              Imported {state.summary.imported} prices
            </p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {state.summary.skipped > 0 && (
                <li>{state.summary.skipped} repeated dates were skipped.</li>
              )}
              {state.summary.errors > 0 && (
                <li className="text-[var(--negative)]">
                  {state.summary.errors} rows could not be read and were left
                  out. Nothing was guessed at.
                </li>
              )}
              {state.summary.ambiguous > 0 && (
                <li className="text-[var(--warning)]">
                  {state.summary.ambiguous} dates could be read either
                  day-first or month-first. They were read day-first, the
                  Singapore convention — worth checking.
                </li>
              )}
            </ul>
          </div>
        )}

        <Submit />
      </form>
    </Card>
  );
}
