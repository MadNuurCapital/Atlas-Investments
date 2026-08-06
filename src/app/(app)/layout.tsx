import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { requireProfile } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";

/**
 * Shell for every signed-in screen.
 *
 * requireProfile() is the real gate: it revalidates the user with Supabase and
 * checks the profile is active. proxy.ts has already done a fast optimistic
 * check, but this is the one that counts.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar role={profile.role} />

      {/* The backdrop lives on the scrolling column, not on <body>, so the
          radial washes stay anchored behind the content while the sidebar
          keeps its own flat surface. */}
      <div className="app-backdrop flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--header-bg)] px-6 shadow-[var(--shadow-header)] backdrop-blur-xl"
        >
          <div className="mr-auto flex min-w-0 items-center gap-2 text-sm">
            {/* Role is shown so a user always knows which hat they are wearing,
                particularly an Admin who also carries their own client book. */}
            <Link
              href="/settings"
              className="truncate font-medium text-foreground underline-offset-4 hover:underline"
            >
              {profile.full_name || profile.email}
            </Link>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
                profile.role === "admin"
                  ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold-deep)] dark:text-[var(--accent-gold)]"
                  : "bg-neutral-surface text-muted-foreground",
              )}
            >
              {profile.role}
            </span>
          </div>
          <ThemeToggle />
          <SignOutButton variant="ghost" showLabel={false} />
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
