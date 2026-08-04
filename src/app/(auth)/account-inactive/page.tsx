import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Account inactive" };

/**
 * Shown when a valid sign-in belongs to a deactivated profile. Being explicit
 * saves the user from assuming they have forgotten their password and
 * retrying until they lock themselves out.
 */
export default function AccountInactivePage() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-[var(--warning-surface)] p-3">
          <ShieldOff className="size-6 text-[var(--warning)]" />
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          This account is not active
        </h1>
        <p className="text-sm text-muted-foreground">
          Your Atlas access has been switched off. Your records are unchanged.
          Please contact your administrator to have access restored.
        </p>
      </div>

      <SignOutButton className="w-full" />
    </div>
  );
}
