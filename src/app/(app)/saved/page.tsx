import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Saved Plans" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Saved Plans"
        description="Saved calculations, portfolios and client reports."
      />
      <ComingSoon phase="Phase 4" />
    </>
  );
}
