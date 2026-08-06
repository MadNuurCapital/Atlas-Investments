import { cn } from "@/lib/cn";
import { NOT_AVAILABLE } from "@/lib/format";

/**
 * A glass panel.
 *
 * The `.glass` class carries the whole look — translucency, blur, the layered
 * shadow and the inset top highlight — and it is defined once in globals.css
 * so light and dark stay in step. See the note there on why the light theme's
 * glass is near-opaque.
 *
 * `interactive` adds the lift-and-gold-edge hover. Use it only where the card
 * is genuinely a link or a button; a hover effect on a card that does nothing
 * teaches people to click things that do nothing.
 */
export function Card({
  className,
  interactive = false,
  children,
}: {
  className?: string;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "glass rounded-[var(--radius)] p-5",
        interactive && "glass-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  /** Adds the hairline gold rule. For the lead card on a screen, not all. */
  accent?: boolean;
}) {
  return (
    <h2
      className={cn(
        "mb-4 text-sm font-semibold tracking-tight text-foreground",
        accent && "gold-rule",
      )}
    >
      {children}
    </h2>
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
  headline = false,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "positive" | "negative";
  /**
   * The one figure on the screen that matters most — a portfolio's total
   * value, a projection's result. Renders large, with the gold treatment.
   *
   * Deliberately ignored when the value is unavailable or carries a gain/loss
   * tone: a glowing gold "Not available" would be absurd, and a gain that is
   * gold instead of green has lost the only thing its colour was saying.
   */
  headline?: boolean;
  className?: string;
}) {
  const unavailable = value === NOT_AVAILABLE;
  const asHeadline = headline && !unavailable && tone === "neutral";

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 truncate font-semibold",
          asHeadline ? "headline-figure text-3xl font-bold" : "text-xl",
          unavailable && "text-base font-normal italic text-subtle-foreground",
          !unavailable && tone === "positive" && "text-[var(--positive)]",
          !unavailable && tone === "negative" && "text-[var(--negative)]",
          !unavailable && !asHeadline && tone === "neutral" && "text-foreground",
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
      className="rounded-md border border-[var(--negative)]/25 bg-[var(--negative-surface)] p-3 text-sm text-[var(--negative)]"
    >
      {children}
    </div>
  );
}

/**
 * Confirmation that something worked.
 *
 * This exists because it was missing: forms returned "Saved." and it was
 * rendered through ErrorNotice, so every successful save reported itself in
 * red alarm colours. A person cannot be expected to trust a system that
 * shouts at them for doing the right thing.
 *
 * `role="status"` rather than `role="alert"` — a screen reader should mention
 * this when it gets a chance, not interrupt to announce that nothing is wrong.
 */
export function SuccessNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-md border border-[var(--positive)]/25 bg-[var(--positive-surface)] p-3 text-sm text-[var(--positive)]"
    >
      {children}
    </div>
  );
}

/**
 * Renders a form action's message as success or failure.
 *
 * Server actions return a single `message` for both outcomes, so something
 * has to decide which it was. Making that decision in one place means a new
 * form cannot get it wrong by forgetting.
 */
export function FormNotice({
  message,
  ok,
}: {
  message?: string;
  /** Explicit outcome. Omit only when the action returns messages on failure alone. */
  ok?: boolean;
}) {
  if (!message) return null;
  return ok ? (
    <SuccessNotice>{message}</SuccessNotice>
  ) : (
    <ErrorNotice>{message}</ErrorNotice>
  );
}
