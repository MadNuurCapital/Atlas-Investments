"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, FormNotice } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "../../clients/actions";
import type { Fund } from "@/lib/supabase/types";

const RISK = [
  ["", "Not stated"],
  ["very_low", "Very low"],
  ["low", "Low"],
  ["moderate", "Moderate"],
  ["moderately_high", "Moderately high"],
  ["high", "High"],
  ["very_high", "Very high"],
] as const;

const FREQUENCY = [
  ["none", "None"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["semi_annual", "Twice yearly"],
  ["annual", "Yearly"],
  ["irregular", "Irregular"],
] as const;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Percentages are stored as fractions; the form works in whole percent. */
function toPercentInput(fraction: number | null | undefined) {
  if (fraction === null || fraction === undefined) return "";
  return String(Number((fraction * 100).toFixed(4)));
}

export function FundForm({
  action,
  fund,
  submitLabel = "Save fund",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fund?: Fund;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardTitle>Identity</CardTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Share class is a separate field and matters. Two classes of the same
          fund have genuinely different returns, so Atlas never merges funds on
          a similar name.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Fund name" htmlFor="name" required error={state.errors?.name}>
            <Input id="name" name="name" defaultValue={fund?.name} required autoFocus={!fund} />
          </Field>

          <Field
            label="Share class"
            htmlFor="share_class"
            hint="Exactly as the factsheet states, e.g. “Class A (Acc) SGD”."
            error={state.errors?.share_class}
          >
            <Input id="share_class" name="share_class" defaultValue={fund?.share_class ?? ""} />
          </Field>

          <Field label="ISIN" htmlFor="isin" error={state.errors?.isin}>
            <Input id="isin" name="isin" defaultValue={fund?.isin ?? ""} />
          </Field>

          <Field label="Fund manager" htmlFor="fund_manager" error={state.errors?.fund_manager}>
            <Input id="fund_manager" name="fund_manager" defaultValue={fund?.fund_manager ?? ""} />
          </Field>

          <Field label="Currency" htmlFor="currency" required error={state.errors?.currency}>
            <Input
              id="currency"
              name="currency"
              defaultValue={fund?.currency ?? "SGD"}
              maxLength={3}
              className="uppercase"
              required
            />
          </Field>

          <Field label="Category / asset class" htmlFor="category" error={state.errors?.category}>
            <Input id="category" name="category" defaultValue={fund?.category ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Characteristics</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Risk level" htmlFor="risk_level">
            <Select id="risk_level" name="risk_level" defaultValue={fund?.risk_level ?? ""}>
              {RISK.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shariah status" htmlFor="shariah_status">
            <Select
              id="shariah_status"
              name="shariah_status"
              defaultValue={fund?.shariah_status ?? "unknown"}
            >
              <option value="unknown">Unknown</option>
              <option value="shariah">Shariah</option>
              <option value="conventional">Conventional</option>
            </Select>
          </Field>

          <Field label="Type" htmlFor="distribution_type">
            <Select
              id="distribution_type"
              name="distribution_type"
              defaultValue={fund?.distribution_type ?? "accumulation"}
            >
              <option value="accumulation">Accumulation</option>
              <option value="distribution">Distribution</option>
            </Select>
          </Field>

          <Field label="Distribution frequency" htmlFor="distribution_frequency">
            <Select
              id="distribution_frequency"
              name="distribution_frequency"
              defaultValue={fund?.distribution_frequency ?? "none"}
            >
              {FREQUENCY.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Inception date" htmlFor="inception_date" error={state.errors?.inception_date}>
            <Input
              id="inception_date"
              name="inception_date"
              type="date"
              defaultValue={fund?.inception_date ?? ""}
            />
          </Field>

          <Field
            label="Factsheet link"
            htmlFor="factsheet_url"
            error={state.errors?.factsheet_url}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Input
              id="factsheet_url"
              name="factsheet_url"
              type="url"
              placeholder="https://…"
              defaultValue={fund?.factsheet_url ?? ""}
            />
          </Field>
        </div>

        <Field
          label="Plain-language description"
          htmlFor="description"
          className="mt-5"
          error={state.errors?.description}
        >
          <Textarea id="description" name="description" rows={3} defaultValue={fund?.description ?? ""} />
        </Field>
      </Card>

      <Card>
        <CardTitle accent>Past performance</CardTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter whole percentages from the factsheet, e.g. <code>5.2</code> for
          5.2%. Leave a field blank if the factsheet does not state it — blank
          shows as &ldquo;Not available&rdquo;, which is different from zero.
          These figures are never used as a projection assumption.
        </p>

        <p className="mb-5 rounded-[var(--radius)] border border-[var(--info)]/25 bg-[var(--info-surface)] p-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">
            Anything you type here is yours.
          </strong>{" "}
          The daily refresh calculates these figures from price history, but it
          will not overwrite a box you have filled in. Clear a box and save to
          hand that figure back to the automatic update.
        </p>

        <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-7">
          {(
            [
              ["perf_ytd", "Year to date", fund?.perf_ytd],
              ["perf_1m", "1 month", fund?.perf_1m],
              ["perf_6m", "6 months", fund?.perf_6m],
              ["perf_1y", "1 year", fund?.perf_1y],
              ["perf_3y", "3 years", fund?.perf_3y],
              ["perf_5y", "5 years", fund?.perf_5y],
              ["perf_since_inception", "Inception", fund?.perf_since_inception],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name} label={label} htmlFor={name} error={state.errors?.[name]}>
              <Input
                id={name}
                name={name}
                inputMode="decimal"
                placeholder="%"
                defaultValue={toPercentInput(value)}
              />
            </Field>
          ))}
        </div>
      </Card>

      <FormNotice message={state.message} ok={state.ok} />

      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
