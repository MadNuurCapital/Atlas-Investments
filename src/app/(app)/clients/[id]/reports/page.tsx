import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClientSnapshot } from "@/components/reports/client-snapshot";
import { ReportControls } from "./report-controls";
import { getSnapshot, type NameStyle } from "@/lib/data/snapshot";

export const metadata: Metadata = { title: "Reports" };

export default async function ClientReportsPage({
  params,
  searchParams,
}: PageProps<"/clients/[id]/reports">) {
  const { id } = await params;
  const query = await searchParams;

  const nameStyle = (
    ["full", "first", "initials"].includes(query.name as string)
      ? query.name
      : "full"
  ) as NameStyle;
  const showAdvisor = query.advisor !== "0";
  const reviewId = typeof query.review === "string" ? query.review : undefined;

  const data = await getSnapshot(id, { reviewId, nameStyle });
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <Card className="no-print border-[var(--info)] bg-[var(--info-surface)]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--info)]" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Safe to share</p>
            <p className="mt-1 text-muted-foreground">
              This card is built from a data shape that cannot contain your
              internal notes, the client&apos;s private contact details, or any
              database identifiers — those fields are never read, not merely
              hidden. It always renders light, whichever theme you are working
              in, so it is readable on screen and on paper.
            </p>
          </div>
        </div>
      </Card>

      <ReportControls
        clientId={id}
        nameStyle={nameStyle}
        showAdvisor={showAdvisor}
        reviewId={reviewId}
      />

      {/* The card is a fixed 1200px wide; scale it down to fit the screen
          while keeping the exported image and print output at full size. */}
      <div className="no-print overflow-x-auto rounded-lg border border-[var(--border)] bg-surface-sunken p-6">
        <div className="mx-auto w-fit origin-top scale-[0.55] lg:scale-[0.7]">
          <div className="shadow-xl">
            <ClientSnapshot data={data} showAdvisorName={showAdvisor} />
          </div>
        </div>
      </div>

      {/* Print / screenshot target: full size, no surrounding chrome. */}
      <div className="print-only hidden">
        <ClientSnapshot data={data} showAdvisorName={showAdvisor} />
      </div>
    </div>
  );
}
