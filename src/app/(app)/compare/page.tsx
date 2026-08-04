import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Compare Funds" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Compare Funds"
        description="Compare up to three funds side by side."
      />
      <ComingSoon phase="Phase 4" />
    </>
  );
}
