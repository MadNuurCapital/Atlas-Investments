"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, FormNotice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { changeMyPassword, updateMyName } from "./actions";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Your display name.
 *
 * This is the name clients see on their snapshot. Until this screen existed
 * there was nowhere to set it, so an account created from the Supabase
 * dashboard — which never asks for a name — was stuck showing an email
 * address in the header and "Your adviser" on every client report.
 */
export function NameForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateMyName, {});

  return (
    <Card>
      <CardTitle accent>Your details</CardTitle>

      <form action={action} className="space-y-4">
        <Field
          label="Your name"
          htmlFor="full_name"
          required
          error={state.errors?.full_name}
          hint="Shown in the header, and on client snapshots as the adviser's name."
          className="max-w-sm"
        >
          <Input
            id="full_name"
            name="full_name"
            defaultValue={fullName}
            required
            maxLength={120}
            autoComplete="name"
            aria-invalid={state.errors?.full_name ? true : undefined}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          hint="This is your sign-in address and cannot be changed here."
          className="max-w-sm"
        >
          <Input id="email" value={email} disabled readOnly />
        </Field>

        <FormNotice message={state.message} ok={state.ok} />

        <Save label="Save name" />
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changeMyPassword, {});

  return (
    <Card>
      <CardTitle>Change your password</CardTitle>

      <form action={action} className="space-y-4">
        <Field
          label="New password"
          htmlFor="password"
          required
          error={state.errors?.password}
          hint="At least 12 characters. Length beats symbols."
          className="max-w-sm"
        >
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            aria-invalid={state.errors?.password ? true : undefined}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirm"
          required
          error={state.errors?.confirm}
          className="max-w-sm"
        >
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            aria-invalid={state.errors?.confirm ? true : undefined}
          />
        </Field>

        <FormNotice message={state.message} ok={state.ok} />

        <Save label="Change password" />
      </form>
    </Card>
  );
}
