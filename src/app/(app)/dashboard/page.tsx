import type { Metadata } from "next";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth/dal";
import { formatSgDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Phase 1 dashboard.
 *
 * The review-reminder tiles, recently reviewed clients and watched funds all
 * arrive in Phase 2 and 3, when there is real data behind them. Until then
 * this screen reports build status honestly rather than showing zeroes that
 * look like real answers.
 */

const PHASES = [
  {
    name: "Phase 1 — Foundation",
    done: true,
    items: [
      "Authentication, invitations and password reset",
      "Advisor and Admin roles",
      "Row Level Security foundation",
      "Light and dark themes, Atlas branding",
      "Application shell and navigation",
    ],
  },
  {
    name: "Phase 2 — Clients and Reviews",
    done: false,
    items: [
      "Client records and multiple holdings",
      "Contributions, withdrawals and dividends",
      "Quarterly review workflow and snapshots",
      "Reminders at 30, 14 and 7 days, and overdue",
    ],
  },
  { name: "Phase 3 — Fund Centre", done: false, items: [] },
  { name: "Phase 4 — Calculators and Portfolio Builder", done: false, items: [] },
  { name: "Phase 5 — Reports and hardening", done: false, items: [] },
];

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name.split(" ")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`Signed in as ${profile.role} · ${formatSgDate(new Date())}`}
      />

      <div className="rounded-lg border border-[var(--border)] bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">Build progress</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Atlas Investments is being built in phases. Screens in the sidebar
          that are not finished say so plainly instead of showing sample
          figures.
        </p>

        <ul className="mt-5 space-y-4">
          {PHASES.map((phase) => (
            <li key={phase.name} className="flex gap-3">
              {phase.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--positive)]" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
              )}
              <div className="min-w-0">
                <p
                  className={
                    phase.done
                      ? "text-sm font-medium text-foreground"
                      : "text-sm font-medium text-muted-foreground"
                  }
                >
                  {phase.name}
                </p>
                {phase.items.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {phase.items.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
