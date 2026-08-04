import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Portfolio Builder" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Portfolio Builder"
        description="Build an illustrative portfolio of four to eight funds."
      />
      <ComingSoon phase="Phase 4" />
    </>
  );
}
