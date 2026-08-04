import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Reports" };

export default function ClientReportsPage() {
  return (
    <ComingSoon phase="Phase 5">
      The Client Snapshot card and the printable PDF summary are built in
      Phase 5, once the calculators are in place so the goal projection can be
      included.
    </ComingSoon>
  );
}
