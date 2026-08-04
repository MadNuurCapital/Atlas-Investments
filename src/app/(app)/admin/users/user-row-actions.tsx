"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { setUserActive, setUserRole } from "../actions";

export function UserRowActions({
  userId,
  role,
  isActive,
}: {
  userId: string;
  role: "advisor" | "admin";
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        aria-label="Role"
        defaultValue={role}
        disabled={pending}
        className="h-8 w-28 text-xs"
        onChange={(event) =>
          startTransition(() =>
            setUserRole(userId, event.target.value as "advisor" | "admin"),
          )
        }
      >
        <option value="advisor">Advisor</option>
        <option value="admin">Admin</option>
      </Select>

      <Button
        variant={isActive ? "secondary" : "primary"}
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => setUserActive(userId, !isActive))}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
