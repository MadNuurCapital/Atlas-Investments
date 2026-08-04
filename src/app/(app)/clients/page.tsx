import type { Metadata } from "next";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Clients" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Your client records. Only clients assigned to you are visible."
      />
      <ComingSoon phase="Phase 2" />
    </>
  );
}
