import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  // Server-side gate. Hiding the sidebar link is presentation only; this is
  // what actually stops a non-admin reaching the route by typing the URL.
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Users, fund data, imports and system settings."
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--info-surface)] p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--info)]" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            Administrators cannot browse other advisors&apos; clients
          </p>
          <p className="mt-1 text-muted-foreground">
            This is enforced by the database, not by hiding screens. Admin
            covers users, funds, imports and settings. If you also advise
            clients of your own, they appear under Clients like anyone
            else&apos;s and remain private to you.
          </p>
        </div>
      </div>

      <ComingSoon phase="Phase 3" />
    </>
  );
}
