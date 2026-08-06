"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { FormNotice } from "@/components/ui/card";
import type { FormState } from "../../actions";
import type { ClientHolding, HoldingStatus } from "@/lib/supabase/types";

const STATUSES: { value: HoldingStatus; label: string; hint: string }[] = [
  { value: "active", label: "Active", hint: "Contributing and invested" },
  { value: "paused", label: "Paused", hint: "Contributions stopped, still invested" },
  { value: "matured", label: "Matured", hint: "Reached its natural end" },
  { value: "closed", label: "Closed", hint: "Surrendered or fully withdrawn" },
  { value: "lapsed", label: "Lapsed", hint: "Policy lapsed, typically non-payment" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function HoldingForm({
  action,
  holding,
  onDone,
  submitLabel = "Save holding",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  holding?: ClientHolding;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [status, setStatus] = useState<HoldingStatus>(holding?.status ?? "active");

  // Anything other than Active needs the date contributions stopped, because
  // that date is what makes the contribution total correct.
  const needsCeasedDate = status !== "active";

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Provider" htmlFor="provider" required error={state.errors?.provider}>
          <Input
            id="provider"
            name="provider"
            defaultValue={holding?.provider}
            placeholder="e.g. Tokio Marine"
            required
          />
        </Field>

        <Field
          label="Product name"
          htmlFor="product_name"
          required
          error={state.errors?.product_name}
        >
          <Input
            id="product_name"
            name="product_name"
            defaultValue={holding?.product_name}
            required
          />
        </Field>
      </div>

      <Field
        label="Fund name"
        htmlFor="fund_name_manual"
        hint="Type the fund name. Linking to a Fund Centre record comes in Phase 3."
        error={state.errors?.fund_name_manual}
      >
        <Input
          id="fund_name_manual"
          name="fund_name_manual"
          defaultValue={holding?.fund_name_manual ?? ""}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Initial lump sum"
          htmlFor="initial_lump_sum"
          error={state.errors?.initial_lump_sum}
        >
          <MoneyInput
            id="initial_lump_sum"
            name="initial_lump_sum"
            defaultValue={holding?.initial_lump_sum ?? 0}
          />
        </Field>

        <Field
          label="Monthly contribution"
          htmlFor="monthly_contribution"
          error={state.errors?.monthly_contribution}
        >
          <MoneyInput
            id="monthly_contribution"
            name="monthly_contribution"
            defaultValue={holding?.monthly_contribution ?? 0}
          />
        </Field>

        <Field
          label="Start date"
          htmlFor="start_date"
          required
          error={state.errors?.start_date}
        >
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={holding?.start_date}
            required
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Current value"
          htmlFor="current_value"
          hint="From the latest provider statement."
          error={state.errors?.current_value}
        >
          <MoneyInput
            id="current_value"
            name="current_value"
            defaultValue={holding?.current_value ?? ""}
          />
        </Field>

        <Field
          label="Value accurate as at"
          htmlFor="current_value_as_of"
          error={state.errors?.current_value_as_of}
        >
          <Input
            id="current_value_as_of"
            name="current_value_as_of"
            type="date"
            defaultValue={holding?.current_value_as_of ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status" htmlFor="status" error={state.errors?.status}>
          <Select
            id="status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as HoldingStatus)}
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </Select>
        </Field>

        {needsCeasedDate && (
          <Field
            label="Contributions stopped on"
            htmlFor="contributions_ceased_on"
            required
            hint="Contribution totals stop accruing from this date."
            error={state.errors?.contributions_ceased_on}
          >
            <Input
              id="contributions_ceased_on"
              name="contributions_ceased_on"
              type="date"
              defaultValue={holding?.contributions_ceased_on ?? ""}
              required
            />
          </Field>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Policy / account reference"
          htmlFor="policy_reference"
          error={state.errors?.policy_reference}
        >
          <Input
            id="policy_reference"
            name="policy_reference"
            defaultValue={holding?.policy_reference ?? ""}
          />
        </Field>
      </div>

      <Field
        label="Investment goal"
        htmlFor="investment_goal"
        error={state.errors?.investment_goal}
      >
        <Textarea
          id="investment_goal"
          name="investment_goal"
          rows={2}
          defaultValue={holding?.investment_goal ?? ""}
          placeholder="e.g. Retirement income from 2045"
        />
      </Field>

      <FormNotice message={state.message} ok={state.ok} />
      {state.message && !state.errors && (
        <p className="text-sm text-[var(--positive)]" role="status">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
