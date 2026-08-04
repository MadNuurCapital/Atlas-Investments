import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // searchParams is async in Next 16.
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Accounts are created by your administrator.
        </p>
      </div>

      <LoginForm next={next} />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/reset-password"
          className="font-medium text-[var(--brand-500)] hover:underline dark:text-[var(--brand-400)]"
        >
          Forgotten your password?
        </Link>
      </p>
    </div>
  );
}
