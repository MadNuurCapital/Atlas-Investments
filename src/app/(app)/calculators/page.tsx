import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CALCULATORS, ILLUSTRATION_DISCLAIMER } from "@/lib/calculators/registry";

export const metadata: Metadata = { title: "Calculators" };

export default function CalculatorsPage() {
  return (
    <>
      <PageHeader
        title="Calculators"
        description="Every result is shown at three growth assumptions, never as a single number."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((calculator) => (
          <Link
            key={calculator.slug}
            href={`/calculators/${calculator.slug}`}
            className="group rounded-lg border border-[var(--border)] bg-surface p-5 transition-colors hover:border-[var(--brand-400)]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
              {calculator.question}
            </p>
            <h2 className="mt-1.5 flex items-center gap-2 text-base font-semibold text-foreground">
              {calculator.name}
              <ArrowRight className="size-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{calculator.summary}</p>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <p className="text-sm text-muted-foreground">{ILLUSTRATION_DISCLAIMER}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Atlas never uses a fund&apos;s past performance as a future-return
          assumption. Growth assumptions come from you, or from the firm&apos;s
          configured defaults.
        </p>
      </Card>
    </>
  );
}
