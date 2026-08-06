import { Badge } from "@/components/ui/card";
import { HEALTH_LABELS, type DataHealth } from "@/lib/funds/labels";
import { formatSgDate } from "@/lib/format";

/**
 * Data freshness, shown wherever a NAV is shown.
 *
 * "Manually managed" is deliberately neutral, not a warning. A fund
 * maintained from factsheets is working as designed; colouring it amber
 * would train advisors to ignore genuine warnings.
 */
const HEALTH_TONE: Record<DataHealth, "positive" | "warning" | "negative" | "neutral"> = {
  current: "positive",
  stale: "warning",
  failed: "negative",
  missing: "warning",
  manual: "neutral",
};

export function DataHealthBadge({
  health,
  navDate,
}: {
  health: DataHealth;
  navDate?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={HEALTH_TONE[health]}>{HEALTH_LABELS[health]}</Badge>
      {navDate && health !== "missing" && (
        <span className="text-xs text-muted-foreground">
          NAV {formatSgDate(navDate)}
        </span>
      )}
    </span>
  );
}

export function ShariahBadge({ status }: { status: string }) {
  if (status === "shariah") return <Badge tone="positive">Shariah</Badge>;
  if (status === "conventional") return <Badge tone="neutral">Conventional</Badge>;
  return <Badge tone="warning">Shariah status unknown</Badge>;
}
