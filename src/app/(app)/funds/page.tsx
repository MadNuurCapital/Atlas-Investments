import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Fund Centre" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Fund Centre"
        description="Search mutual funds and insurer-linked underlying funds."
      />
      <ComingSoon phase="Phase 3" />
    </>
  );
}
