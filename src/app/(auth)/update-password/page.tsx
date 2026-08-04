import type { Metadata } from "next";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a password you don&apos;t use anywhere else.
        </p>
      </div>

      <PasswordForm />
    </div>
  );
}
