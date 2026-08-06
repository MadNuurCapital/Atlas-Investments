import { cn } from "@/lib/cn";

/**
 * Loading placeholders.
 *
 * Every screen in this app is server-rendered on demand, which means a click
 * costs a round trip — and until these existed the browser simply held the
 * previous page on screen for the whole trip. Nothing acknowledged the click,
 * so the app felt broken rather than busy. On a cold Netlify function that
 * silence ran to about five seconds.
 *
 * A `loading.tsx` file makes Next.js stream this instantly while the real
 * page is still being built on the server. The work takes exactly as long as
 * it did before; the difference is that the person can see it happening.
 *
 * The rule these follow: **match the real layout**. A skeleton of the wrong
 * shape is worse than none, because the page visibly jumps when the content
 * lands and the eye has to find its place again.
 */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden {...props} />;
}

/** Announces the wait once, rather than every block shouting individually. */
export function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy>
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

export function SkeletonPageHeader({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

export function SkeletonCard({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("glass rounded-[var(--radius)] p-5", className)}>
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            // Ragged line lengths read as text. Equal bars read as a chart,
            // which is a different promise about what is coming.
            style={{ width: `${92 - i * 13}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** A row of headline figures, as on the dashboard and client pages. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-[var(--radius)] p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2.5 h-7 w-36" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="glass overflow-hidden rounded-[var(--radius)]">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <Skeleton className="h-3.5 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-4 last:border-0"
        >
          <Skeleton className="h-4 flex-[2]" />
          {Array.from({ length: columns - 1 }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-[var(--radius)] p-5", className)}>
      <Skeleton className="mb-4 h-4 w-40" />
      {/* Bars of varied height, so the shape suggests a chart rather than a
          table that is about to appear in its place. */}
      <div className="flex h-48 items-end gap-2">
        {[42, 58, 35, 71, 64, 88, 52, 76, 61, 94, 70, 83].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div className="glass rounded-[var(--radius)] p-5">
      <Skeleton className="mb-5 h-4 w-40" />
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
