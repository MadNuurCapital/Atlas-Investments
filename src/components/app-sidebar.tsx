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
  UserCog,
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
  { href: "/settings", label: "Your account", Icon: UserCog },
];

export function AppSidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();

  // Hiding Admin is a courtesy, not a control. The route itself calls
  // requireAdmin() on the server and the database refuses regardless.
  const items = NAV.filter((item) => !item.adminOnly || role === "admin");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
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
              /*
               * prefetch is on by default for links in the viewport, and the
               * whole sidebar is always in the viewport — so every screen is
               * already being fetched before it is clicked. Left explicit
               * because it is load-bearing for how fast this feels, and a
               * future edit should have to think before removing it.
               */
              prefetch
              className={cn(
                "group relative flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-fg)]"
                  : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
              )}
            >
              {/* The gold bar is "you are here", never status. It is the same
                  accent as the headline figure and the chart lines, so the eye
                  learns one colour for "this is the thing you want". */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent-gold)] shadow-[0_0_10px_var(--accent-gold)]"
                />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active && "text-[var(--accent-gold)]",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
