import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, CardTitle, StatTile } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [users, funds, autoFunds, staleFunds] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("funds")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false),
    supabase
      .from("funds")
      .select("id", { count: "exact", head: true })
      .eq("auto_refresh_enabled", true),
    supabase
      .from("funds")
      .select("id", { count: "exact", head: true })
      .eq("last_refresh_status", "failed"),
  ]);

  return (
    <div className="space-y-6">
      <Card className="border-[var(--info)] bg-[var(--info-surface)]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--info)]" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Administrators cannot browse other advisors&apos; clients
            </p>
            <p className="mt-1 text-muted-foreground">
              This is enforced by the database, not by hiding screens. Admin
              covers users, funds, imports and settings. If you also advise
              clients of your own, they appear under Clients like anyone
              else&apos;s and stay private to you.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>At a glance</CardTitle>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Users" value={String(users.count ?? 0)} />
          <StatTile label="Funds" value={String(funds.count ?? 0)} />
          <StatTile
            label="Auto-refreshing"
            value={String(autoFunds.count ?? 0)}
            sub="Verified symbols only"
          />
          <StatTile
            label="Refresh failures"
            value={String(staleFunds.count ?? 0)}
            tone={(staleFunds.count ?? 0) > 0 ? "negative" : "neutral"}
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/users" className={`${buttonVariants({ variant: "secondary" })} justify-start`}>
          Invite and manage users
        </Link>
        <Link href="/admin/funds" className={`${buttonVariants({ variant: "secondary" })} justify-start`}>
          Manage fund data
        </Link>
        <Link href="/admin/data-health" className={`${buttonVariants({ variant: "secondary" })} justify-start`}>
          Check data health
        </Link>
      </div>
    </div>
  );
}
