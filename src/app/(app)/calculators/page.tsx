import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Calculators" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Calculators"
        description="Projection, contribution, lump sum, retirement, dividend, Hajj and starting point."
      />
      <ComingSoon phase="Phase 4" />
    </>
  );
}
