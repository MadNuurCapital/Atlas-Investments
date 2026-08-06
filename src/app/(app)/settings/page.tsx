import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireProfile } from "@/lib/auth/dal";
import { NameForm, PasswordForm } from "./settings-forms";

export const metadata: Metadata = { title: "Your account" };

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <>
      <PageHeader
        title="Your account"
        description="Your name, your password, and how the app looks to you."
      />

      <div className="grid max-w-3xl gap-5">
        <NameForm fullName={profile.full_name} email={profile.email} />

        <Card>
          <CardTitle>Appearance</CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-md text-sm text-muted-foreground">
              Light, dark, or follow your computer. This is stored on this
              device, so it can differ between your laptop and the office
              machine. Client snapshots and printed reports are always light,
              whichever you pick.
            </p>
            <ThemeToggle />
          </div>
        </Card>

        <PasswordForm />

        <Card>
          <CardTitle>Your role</CardTitle>
          <p className="text-sm text-muted-foreground">
            You are signed in as{" "}
            <span className="font-medium capitalize text-foreground">
              {profile.role}
            </span>
            .{" "}
            {profile.role === "admin"
              ? "You can manage users, funds and settings. You cannot see another adviser's clients — no one can, including you."
              : "Only an administrator can change roles, and only from the Users screen."}
          </p>
        </Card>
      </div>
    </>
  );
}
