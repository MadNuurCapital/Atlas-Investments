"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import type { NameStyle } from "@/lib/data/snapshot";

/**
 * Snapshot options.
 *
 * The PDF is produced through the browser's own print-to-PDF rather than a
 * PDF library. That is a deliberate choice, not a shortcut: what the advisor
 * sees on screen is exactly what prints, there is no second rendering engine
 * to drift out of step with the first, and it adds no dependency to keep in
 * step with the rest of the app. The print stylesheet fixes A4 and forces a
 * light background regardless of the advisor's theme.
 */
export function ReportControls({
  clientId,
  nameStyle,
  showAdvisor,
  reviewId,
}: {
  clientId: string;
  nameStyle: NameStyle;
  showAdvisor: boolean;
  reviewId?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`/clients/${clientId}/reports?${next.toString()}`);
  }

  return (
    <Card className="no-print">
      <CardTitle>Snapshot options</CardTitle>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Client name shown as" htmlFor="name-style" className="w-56">
          <Select
            id="name-style"
            value={nameStyle}
            onChange={(event) => update("name", event.target.value)}
          >
            <option value="full">Full name</option>
            <option value="first">First name only</option>
            <option value="initials">Initials only</option>
          </Select>
        </Field>

        <Field label="Your name" htmlFor="advisor" className="w-48">
          <Select
            id="advisor"
            value={showAdvisor ? "1" : "0"}
            onChange={(event) => update("advisor", event.target.value)}
          >
            <option value="1">Show</option>
            <option value="0">Hide</option>
          </Select>
        </Field>

        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / save as PDF
        </Button>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Camera className="size-4 shrink-0" />
          For a screenshot, the card below is a fixed 1200 × 1500 — the ratio
          WhatsApp shows without cropping.
        </p>
      </div>

      {reviewId && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing figures as at the selected review, not today.
        </p>
      )}
    </Card>
  );
}
