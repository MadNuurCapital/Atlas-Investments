"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { toggleWatchlist } from "./actions";

/**
 * Starring is optimistic: the star fills the moment it is clicked rather
 * than after a server round trip. A watchlist toggle is trivially
 * reversible, so waiting would be worse than being briefly wrong.
 */
export function WatchToggle({
  fundId,
  isWatched,
}: {
  fundId: string;
  isWatched: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isWatched);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from watchlist" : "Add to watchlist"}
      title={optimistic ? "Remove from watchlist" : "Add to watchlist"}
      className="rounded p-1 hover:bg-surface-sunken"
      onClick={() => {
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleWatchlist(fundId);
        });
      }}
    >
      <Star
        className={cn(
          "size-4",
          optimistic
            ? "fill-[var(--brand-gold)] text-[var(--brand-gold-strong)]"
            : "text-subtle-foreground",
        )}
      />
    </button>
  );
}
