import type { Metadata } from "next";
import { PasswordForm } from "../update-password/password-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default function AcceptInvitePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          Welcome to Atlas Investments
        </h1>
        <p className="text-sm text-muted-foreground">
          Set your name and a password to finish setting up your account.
        </p>
      </div>

      <PasswordForm askForName />
    </div>
  );
}
