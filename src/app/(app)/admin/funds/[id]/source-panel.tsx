"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, ErrorNotice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { testFundSymbol, verifyFundSymbol } from "../../actions";
import type { FormState } from "../../../clients/actions";

type Preview = {
  name: string | null;
  currency: string | null;
  nav: number | null;
  navDate: string | null;
  history: number;
};

function TestButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Checking…" : "Test symbol"}
    </Button>
  );
}

/**
 * Symbol verification.
 *
 * The whole point of this panel is that nobody switches on automatic updates
 * against a symbol they have not looked at. Fetching shows what the source
 * actually returns — name, currency, latest price — so the administrator can
 * confirm it is the right SHARE CLASS, not merely a fund with a similar name.
 *
 * Changing the symbol later clears verification automatically, enforced by a
 * database trigger, so the badge can never outlive what it vouched for.
 */
export function SourcePanel({
  fundId,
  fundName,
  currency,
  sourceIdentifier,
  isVerified,
  autoRefreshEnabled,
}: {
  fundId: string;
  fundName: string;
  currency: string;
  sourceIdentifier: string | null;
  isVerified: boolean;
  autoRefreshEnabled: boolean;
}) {
  const [state, formAction] = useActionState<
    FormState & { preview?: string },
    FormData
  >(testFundSymbol, {});
  const [pending, startTransition] = useTransition();

  // The symbol that was actually tested. Verification stores exactly this
  // string, so the badge can never vouch for something else.
  const [testedSymbol, setTestedSymbol] = useState(sourceIdentifier ?? "");

  const preview: Preview | null = state.preview
    ? (JSON.parse(state.preview) as Preview)
    : null;

  const currencyMismatch =
    preview?.currency && preview.currency.toUpperCase() !== currency.toUpperCase();

  return (
    <Card>
      <CardTitle>Automatic data source</CardTitle>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isVerified ? (
          <Badge tone="positive">Symbol verified</Badge>
        ) : (
          <Badge tone="warning">Symbol not verified</Badge>
        )}
        {autoRefreshEnabled ? (
          <Badge tone="positive">Auto-refresh on</Badge>
        ) : (
          <Badge tone="neutral">Auto-refresh off</Badge>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Optional. A fund with no automatic source is fully supported — enter
        its NAV by hand or paste its history below. Yahoo Finance&apos;s
        coverage of Singapore-distributed and insurer-linked funds is patchy,
        so expect some funds to have no usable symbol.
      </p>

      {/*
       * Verifying reloads this page so the new badges appear, and a reload
       * discards anything typed into the fund form above that has not been
       * saved. Saying so is cheap; losing a screen of factsheet figures and
       * not knowing why is not.
       */}
      <p className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--warning)]/25 bg-[var(--warning-surface)] p-3 text-sm text-[var(--warning)]">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Save the fund details above first. Verifying a symbol reloads this
          page, and any unsaved typing in those boxes is lost.
        </span>
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <Field
          label="Yahoo Finance symbol"
          htmlFor="source_identifier"
          className="min-w-56 flex-1"
          hint="Nothing is stored until you verify it below."
        >
          <Input
            id="source_identifier"
            name="source_identifier"
            value={testedSymbol}
            onChange={(event) => setTestedSymbol(event.target.value)}
            placeholder="e.g. 0P0000XYZ1.SI"
          />
        </Field>
        <TestButton />
      </form>

      {state.message && (
        <div className="mt-4">
          <ErrorNotice>{state.message}</ErrorNotice>
        </div>
      )}

      {preview && (
        <div className="mt-4 rounded-md border border-[var(--border)] bg-surface-sunken p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldQuestion className="size-4 text-[var(--info)]" />
            Is this the same fund and share class as{" "}
            <span className="font-semibold">{fundName}</span>?
          </p>

          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Source calls it</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {preview.name ?? "Unnamed"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {preview.currency ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Latest price</dt>
              <dd className="tabular mt-0.5 font-medium text-foreground">
                {preview.nav ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">History available</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {preview.history} prices
              </dd>
            </div>
          </dl>

          {currencyMismatch && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-[var(--warning-surface)] p-3 text-sm text-[var(--warning)]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              The source reports {preview.currency} but this fund is recorded
              as {currency}. That usually means the symbol is a different share
              class. Check before verifying.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await verifyFundSymbol(fundId, testedSymbol, true);
                })
              }
            >
              <CheckCircle2 className="size-4" />
              Yes — verify and turn on daily refresh
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await verifyFundSymbol(fundId, testedSymbol, false);
                })
              }
            >
              Verify, but leave refresh off
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Yahoo Finance data is not licensed for commercial redistribution. It is
        appropriate for internal use; whether it may appear in client-facing
        output is a compliance decision for the firm. The adapter is built to
        be replaced by a licensed provider.
      </p>
    </Card>
  );
}
