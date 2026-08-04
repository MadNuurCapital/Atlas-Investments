"use client";

import { useState, useTransition } from "react";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { snoozeReminder } from "./actions";

const OPTIONS = [7, 14, 30] as const;

/**
 * Quieten a reminder for a while.
 *
 * There is deliberately no "dismiss" option. An overdue review stays in the
 * overdue count however often it is snoozed — only completing it clears the
 * obligation, which is the whole point of tracking reviews.
 */
export function SnoozeButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-expanded={open}
        aria-label="Snooze reminder"
        title="Snooze reminder"
      >
        <BellOff className="size-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-md border border-[var(--border)] bg-surface p-1 shadow-lg">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Quieten for…
          </p>
          {OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-sunken"
              onClick={() => {
                setOpen(false);
                startTransition(() => {
                  void snoozeReminder(clientId, days);
                });
              }}
            >
              {days} days
            </button>
          ))}
          <p className="border-t border-[var(--border)] px-2 py-1.5 text-xs text-subtle-foreground">
            Still counts as due until reviewed.
          </p>
        </div>
      )}
    </div>
  );
}
