"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordReset, type ResetState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sent) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md bg-[var(--info-surface)] p-3 text-sm text-foreground"
      >
        <MailCheck className="mt-0.5 size-4 shrink-0 text-[var(--info)]" />
        <span>
          If an Atlas account exists for that address, a reset link is on its
          way. The link expires after one hour.
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email" htmlFor="reset-email">
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </Field>

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-[var(--negative-surface)] p-3 text-sm text-[var(--negative)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
