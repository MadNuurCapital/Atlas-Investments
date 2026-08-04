"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updatePassword, type UpdatePasswordState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function PasswordForm({ askForName = false }: { askForName?: boolean }) {
  const [state, formAction] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {askForName && (
        <Field label="Your full name" htmlFor="fullName">
          <Input id="fullName" name="fullName" required autoFocus />
        </Field>
      )}

      <Field
        label="New password"
        htmlFor="password"
        hint="At least 12 characters. Longer is better than complicated."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          autoFocus={!askForName}
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
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

      <SubmitButton label={askForName ? "Create my account" : "Update password"} />
    </form>
  );
}
