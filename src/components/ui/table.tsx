import { cn } from "@/lib/cn";

/**
 * Tables, used wherever figures need comparing down a column.
 *
 * Wrapped in an overflow container so a wide table scrolls inside itself
 * rather than pushing the whole page sideways.
 */
export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className={cn("w-full min-w-full border-collapse text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[var(--border)] bg-surface-sunken">
      {children}
    </thead>
  );
}

export function TH({
  children,
  numeric,
  className,
}: {
  children?: React.ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle-foreground",
        numeric ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-[var(--border)]">{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("bg-surface hover:bg-surface-sunken", className)}>
      {children}
    </tr>
  );
}

export function TD({
  children,
  numeric,
  className,
}: {
  children?: React.ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-foreground",
        // Tabular figures keep decimal points aligned down a column of money.
        numeric && "tabular text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
