"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "investments", label: "Investments" },
  { segment: "transactions", label: "Transactions" },
  { segment: "reviews", label: "Reviews" },
  { segment: "reports", label: "Reports" },
  { segment: "history", label: "History" },
] as const;

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;

  return (
    <nav
      aria-label="Client sections"
      className="flex gap-1 overflow-x-auto border-b border-[var(--border)]"
    >
      {TABS.map(({ segment, label }) => {
        const href = segment ? `${base}/${segment}` : base;
        const active = segment
          ? pathname.startsWith(href)
          : pathname === base;

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-[var(--brand-500)] font-medium text-foreground dark:border-[var(--brand-400)]"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
