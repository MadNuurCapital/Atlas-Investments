"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorNotice } from "@/components/ui/card";
import { inviteUser } from "../actions";
import type { FormState } from "../../clients/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send invitation"}
    </Button>
  );
}

export function InviteForm() {
  const [state, formAction] = useActionState<FormState, FormData>(inviteUser, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <Field
        label="Full name"
        htmlFor="full_name"
        required
        error={state.errors?.full_name}
        className="min-w-48 flex-1"
      >
        <Input id="full_name" name="full_name" required />
      </Field>

      <Field
        label="Email"
        htmlFor="invite_email"
        required
        error={state.errors?.email}
        className="min-w-56 flex-1"
      >
        <Input id="invite_email" name="email" type="email" required />
      </Field>

      <Field label="Role" htmlFor="role" className="w-40">
        <Select id="role" name="role" defaultValue="advisor">
          <option value="advisor">Advisor</option>
          <option value="admin">Admin</option>
        </Select>
      </Field>

      <Submit />

      {state.message && (
        <div className="w-full">
          {state.errors ? (
            <ErrorNotice>{state.message}</ErrorNotice>
          ) : (
            <p className="text-sm text-[var(--positive)]" role="status">
              {state.message}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
