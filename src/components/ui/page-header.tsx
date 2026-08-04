import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * Placeholder for routes that exist in the navigation but are built in a
 * later phase.
 *
 * It says plainly that the screen is not built yet. It does NOT show fake
 * charts or invented numbers — placeholder analytics in a system that holds
 * real client money teaches people to distrust every figure on screen.
 */
export function ComingSoon({ phase, children }: { phase: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-surface-sunken p-10 text-center">
      <p className="text-sm font-medium text-foreground">Not built yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This screen is scheduled for {phase}.
      </p>
      {children && (
        <div className="mt-4 text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
