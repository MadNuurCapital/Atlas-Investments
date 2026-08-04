"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { runRefreshNow } from "../actions";

export function RefreshNowButton({ fundId }: { fundId?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => runRefreshNow(fundId))}
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? "Refreshing…" : "Refresh now"}
    </Button>
  );
}
