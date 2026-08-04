import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { requireProfile } from "@/lib/auth/dal";

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
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar role={profile.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-[var(--border)] bg-surface px-6">
          <div className="mr-auto text-sm text-muted-foreground">
            {/* Role is shown so a user always knows which hat they are wearing,
                particularly an Admin who also carries their own client book. */}
            <span className="font-medium text-foreground">
              {profile.full_name || profile.email}
            </span>
            <span className="mx-2 text-subtle-foreground">·</span>
            <span className="capitalize">{profile.role}</span>
          </div>
          <ThemeToggle />
          <SignOutButton variant="ghost" showLabel={false} />
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
