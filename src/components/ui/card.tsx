import { cn } from "@/lib/cn";
import { NOT_AVAILABLE } from "@/lib/format";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-surface p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-semibold text-foreground">{children}</h2>
  );
}

/**
 * A single headline figure.
 *
 * `tone` colours the value for gain and loss. When a value is unavailable it
 * renders muted and italic so it is visibly different from a real zero — a
 * distinction that matters on every screen in this product.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "positive" | "negative";
  className?: string;
}) {
  const unavailable = value === NOT_AVAILABLE;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 truncate text-xl font-semibold",
          unavailable && "text-base font-normal italic text-subtle-foreground",
          !unavailable && tone === "positive" && "text-[var(--positive)]",
          !unavailable && tone === "negative" && "text-[var(--negative)]",
          !unavailable && tone === "neutral" && "text-foreground",
        )}
        title={value}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Picks a tone from a signed figure, staying neutral on zero and null. */
export function toneFor(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "neutral" as const;
  return value > 0 ? ("positive" as const) : ("negative" as const);
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-surface-sunken p-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-neutral-surface text-muted-foreground",
  positive: "bg-[var(--positive-surface)] text-[var(--positive)]",
  negative: "bg-[var(--negative-surface)] text-[var(--negative)]",
  warning: "bg-[var(--warning-surface)] text-[var(--warning)]",
  info: "bg-[var(--info-surface)] text-[var(--info)]",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md bg-[var(--negative-surface)] p-3 text-sm text-[var(--negative)]"
    >
      {children}
    </div>
  );
}
