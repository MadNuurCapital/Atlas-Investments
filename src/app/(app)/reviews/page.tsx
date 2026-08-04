import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Reviews" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Quarterly reviews due, overdue and recently completed."
      />
      <ComingSoon phase="Phase 2" />
    </>
  );
}
