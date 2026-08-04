import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you a link to set a new password.
        </p>
      </div>

      <ResetPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
