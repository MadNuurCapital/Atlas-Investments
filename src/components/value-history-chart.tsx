import { formatSgDate, formatSgd } from "@/lib/format";

export type ValuePoint = { date: string; value: number; contributed: number };

/**
 * Value history from completed review snapshots.
 *
 * Hand-drawn SVG rather than a charting library. The shape is two lines
 * against a shared axis, which is a few lines of maths — pulling in a
 * charting dependency for it would add weight and a hydration boundary for
 * no benefit, and this renders on the server so it appears instantly and
 * prints correctly in the PDF.
 *
 * A single data point is drawn as a dot, not a line. One review is not a
 * trend, and drawing it as one would imply information that does not exist.
 */
export function ValueHistoryChart({
  points,
  height = 220,
}: {
  points: readonly ValuePoint[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] text-sm text-muted-foreground">
        No completed reviews yet — the value history appears after the first review.
      </div>
    );
  }

  const width = 720;
  const padding = { top: 16, right: 16, bottom: 28, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.flatMap((p) => [p.value, p.contributed]);
  const maxValue = Math.max(...values, 1);
  // Always anchor at zero: a truncated axis exaggerates movement, which on a
  // client's portfolio chart is misleading rather than merely inelegant.
  const minValue = 0;
  const span = maxValue - minValue || 1;

  const x = (index: number) =>
    points.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (index / (points.length - 1)) * plotWidth;

  const y = (value: number) =>
    padding.top + plotHeight - ((value - minValue) / span) * plotHeight;

  const line = (key: "value" | "contributed") =>
    points.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: minValue + span * fraction,
    y: padding.top + plotHeight - fraction * plotHeight,
  }));

  const single = points.length === 1;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Portfolio value at each review, from ${formatSgDate(points[0].date)} to ${formatSgDate(points[points.length - 1].date)}`}
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
              {formatSgd(tick.value, { decimals: 0 })}
            </text>
          </g>
        ))}

        {!single && (
          <>
            <polyline
              points={line("contributed")}
              fill="none"
              stroke="var(--subtle-foreground)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <polyline
              points={line("value")}
              fill="none"
              stroke="var(--brand-500)"
              strokeWidth="2.5"
              className="dark:stroke-[var(--brand-400)]"
            />
          </>
        )}

        {points.map((point, index) => (
          <g key={point.date}>
            <circle
              cx={x(index)}
              cy={y(point.contributed)}
              r="3"
              fill="var(--subtle-foreground)"
            />
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r={single ? 5 : 4}
              fill="var(--brand-500)"
              className="dark:fill-[var(--brand-400)]"
            />
            <text
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--subtle-foreground)] text-[10px]"
            >
              {formatSgDate(point.date).slice(3)}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--brand-500)] dark:bg-[var(--brand-400)]" />
          Portfolio value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[var(--subtle-foreground)]" />
          Total contributed
        </span>
        {single && <span>One review recorded — a trend needs at least two.</span>}
      </figcaption>
    </figure>
  );
}
