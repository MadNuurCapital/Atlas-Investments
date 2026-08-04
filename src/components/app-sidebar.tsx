"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calculator,
  CalendarCheck,
  FolderOpen,
  LayoutDashboard,
  Layers,
  Library,
  Settings,
  Users,
} from "lucide-react";
import { AtlasLogo } from "@/components/brand/atlas-logo";
import { cn } from "@/lib/cn";
import type { AppRole } from "@/lib/supabase/types";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/clients", label: "Clients", Icon: Users },
  { href: "/reviews", label: "Reviews", Icon: CalendarCheck },
  { href: "/funds", label: "Fund Centre", Icon: Library },
  { href: "/compare", label: "Compare Funds", Icon: BarChart3 },
  { href: "/portfolio-builder", label: "Portfolio Builder", Icon: Layers },
  { href: "/calculators", label: "Calculators", Icon: Calculator },
  { href: "/saved", label: "Saved Plans", Icon: FolderOpen },
  { href: "/admin", label: "Admin", Icon: Settings, adminOnly: true },
];

export function AppSidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();

  // Hiding Admin is a courtesy, not a control. The route itself calls
  // requireAdmin() on the server and the database refuses regardless.
  const items = NAV.filter((item) => !item.adminOnly || role === "admin");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-surface">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <Link href="/dashboard" aria-label="Atlas Investments — Dashboard">
          <AtlasLogo size="sm" />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--info-surface)] font-medium text-[var(--brand-600)] dark:text-[var(--brand-300)]"
                  : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
              )}
            >
              {/* The gold marker is the one place brand gold appears in the
                  interface chrome — it reads as "you are here", never status. */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[var(--brand-gold)]"
                />
              )}
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
