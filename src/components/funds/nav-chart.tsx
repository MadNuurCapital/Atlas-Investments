import { formatCurrency, formatSgDate } from "@/lib/format";

export type NavPoint = { nav_date: string; nav: number };

/**
 * NAV history chart.
 *
 * Server-rendered SVG: it appears with the page, prints correctly, and adds
 * no JavaScript. The y-axis is NOT anchored at zero here, unlike the client
 * portfolio chart — a fund's NAV moving between 1.20 and 1.35 would be a
 * flat line against a zero baseline, hiding the very movement the chart
 * exists to show. Both axis bounds are labelled so the scale is explicit.
 */
export function NavChart({
  points,
  currency,
  height = 240,
}: {
  points: readonly NavPoint[];
  currency: string;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] px-4 text-center text-sm text-muted-foreground">
        {points.length === 0
          ? "Historical chart not available — no NAV history recorded for this fund."
          : "Only one NAV recorded. A chart needs at least two points."}
      </div>
    );
  }

  const width = 720;
  const padding = { top: 16, right: 16, bottom: 28, left: 72 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const navs = points.map((p) => p.nav);
  const rawMin = Math.min(...navs);
  const rawMax = Math.max(...navs);
  // A flat series would otherwise divide by zero.
  const pad = (rawMax - rawMin) * 0.08 || Math.max(rawMax * 0.02, 0.0001);
  const min = Math.max(rawMin - pad, 0);
  const max = rawMax + pad;
  const span = max - min || 1;

  const x = (index: number) =>
    padding.left + (index / (points.length - 1)) * plotWidth;
  const y = (nav: number) =>
    padding.top + plotHeight - ((nav - min) / span) * plotHeight;

  const line = points.map((point, index) => `${x(index)},${y(point.nav)}`).join(" ");
  const area = `${padding.left},${padding.top + plotHeight} ${line} ${padding.left + plotWidth},${padding.top + plotHeight}`;

  const ticks = [0, 0.5, 1].map((fraction) => ({
    value: min + span * fraction,
    y: padding.top + plotHeight - fraction * plotHeight,
  }));

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`NAV from ${formatSgDate(first.nav_date)} to ${formatSgDate(last.nav_date)}, ranging from ${rawMin} to ${rawMax} ${currency}`}
      >
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-[var(--subtle-foreground)] text-[10px]"
            >
              {tick.value.toFixed(4)}
            </text>
          </g>
        ))}

        <polygon points={area} fill="var(--brand-500)" opacity="0.08" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--brand-500)"
          strokeWidth="2"
          className="dark:stroke-[var(--brand-400)]"
        />

        <text
          x={padding.left}
          y={height - 8}
          className="fill-[var(--subtle-foreground)] text-[10px]"
        >
          {formatSgDate(first.nav_date)}
        </text>
        <text
          x={width - padding.right}
          y={height - 8}
          textAnchor="end"
          className="fill-[var(--subtle-foreground)] text-[10px]"
        >
          {formatSgDate(last.nav_date)}
        </text>
      </svg>

      <figcaption className="mt-2 text-xs text-muted-foreground">
        {points.length} observations · {formatCurrency(rawMin, currency)} to{" "}
        {formatCurrency(rawMax, currency)} · the vertical axis does not start
        at zero, so movement is easier to read.
      </figcaption>
    </figure>
  );
}
