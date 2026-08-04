"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorNotice } from "@/components/ui/card";
import type { FormState } from "./actions";
import type { Client } from "@/lib/supabase/types";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ClientForm({
  action,
  client,
  submitLabel = "Save client",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: Client;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <Field label="Client name" htmlFor="full_name" required error={state.errors?.full_name}>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={client?.full_name}
          required
          autoFocus={!client}
          aria-invalid={state.errors?.full_name ? true : undefined}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={state.errors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            aria-invalid={state.errors?.email ? true : undefined}
          />
        </Field>

        <Field label="Phone" htmlFor="phone" error={state.errors?.phone}>
          <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
        </Field>
      </div>

      <Field
        label="Next review date"
        htmlFor="next_review_date"
        hint="Leave blank to schedule three months from today."
        error={state.errors?.next_review_date}
      >
        <Input
          id="next_review_date"
          name="next_review_date"
          type="date"
          defaultValue={client?.next_review_date ?? ""}
        />
      </Field>

      <Field
        label="Internal notes"
        htmlFor="notes"
        hint="Private to you. Never appears on a client snapshot or PDF."
        error={state.errors?.notes}
      >
        <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} rows={5} />
      </Field>

      {state.message && !state.errors && (
        <p className="text-sm text-[var(--positive)]" role="status">
          {state.message}
        </p>
      )}
      {state.message && state.errors && <ErrorNotice>{state.message}</ErrorNotice>}

      <div className="flex items-center gap-3 pt-1">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
