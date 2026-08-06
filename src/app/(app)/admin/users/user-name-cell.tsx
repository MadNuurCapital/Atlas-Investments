"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { setUserName } from "../actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="icon" className="h-8 w-8" disabled={pending} aria-label="Save name">
      <Check className="size-4" />
    </Button>
  );
}

/**
 * A user's name, editable in place.
 *
 * An account created from the Supabase dashboard has no name at all — that
 * screen never asks for one — so without this an administrator could see the
 * blank but not fix it, and the person themselves had to log in and do it.
 *
 * Editing stays inline rather than opening a dialogue: a name is one short
 * field, and a modal for it would be more ceremony than the change deserves.
 */
export function UserNameCell({
  userId,
  fullName,
  isSelf,
}: {
  userId: string;
  fullName: string;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(setUserName.bind(null, userId), {});

  // Closing on success rather than on submit: if the save is refused the
  // field stays open with what was typed still in it.
  if (editing && state.ok) {
    setEditing(false);
  }

  if (editing) {
    return (
      <form action={action} className="flex items-center gap-1.5">
        <Input
          name="full_name"
          defaultValue={fullName}
          autoFocus
          required
          maxLength={120}
          aria-label="Full name"
          aria-invalid={state.errors?.full_name ? true : undefined}
          className="h-8 w-44 text-sm"
        />
        <SaveButton />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
        >
          <X className="size-4" />
        </Button>
        {state.errors?.full_name && (
          <span className="text-xs text-[var(--negative)]">
            {state.errors.full_name}
          </span>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          fullName
            ? "font-medium text-foreground"
            : "text-sm italic text-subtle-foreground"
        }
      >
        {fullName || "No name set"}
      </span>
      {isSelf && <Badge tone="info">You</Badge>}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setEditing(true)}
        aria-label={`Edit name for ${fullName || "this user"}`}
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  );
}
