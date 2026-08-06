import { cn } from "@/lib/cn";

/**
 * The Atlas Investments mark.
 *
 * Hand-authored SVG rather than a raster file so it scales cleanly, recolours
 * per theme, and costs ~1KB. Geometry: the gold accent square and blue stem
 * form the "i", the nested square block forms the "A" counter.
 *
 * NOTE: this is a geometric reproduction of the supplied logo, pending the
 * official vector file being committed to `public/brand/`. Compare against
 * the original before using it in client-facing print output.
 */
export function AtlasMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 283 265"
      className={cn("h-8 w-auto", className)}
      role="img"
      aria-label="Atlas Investments"
      fill="none"
    >
      {/* Accent square — the dot of the "i" */}
      <rect width="51" height="51" fill="var(--brand-gold)" />
      {/* Stem of the "i" */}
      <rect y="64" width="51" height="201" fill="var(--logo-blue)" />
      {/* Outer frame. evenodd punches a genuine hole rather than painting a
          white square on top, so the mark sits correctly on any background —
          light, dark, or a PDF page. Proportions measured against the
          supplied artwork: the ring is thin at the sides and bottom and
          deeper at the top. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M71 0H283V265H71V0ZM112 66V224H246V66H112Z"
        fill="var(--logo-blue)"
      />
      {/* Nested core square, centred horizontally in the window and sitting
          slightly above its vertical centre, as in the original. */}
      <rect x="148" y="97" width="62" height="66" fill="var(--logo-blue)" />
    </svg>
  );
}

/**
 * Full logo lockup: mark, wordmark, and the firm name.
 *
 * The firm line is a required part of the lockup — it appears in the sidebar,
 * on the Client Snapshot card and in the PDF header.
 */
export function AtlasLogo({
  className,
  showFirm = true,
  size = "md",
}: {
  className?: string;
  showFirm?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const scale = {
    sm: { mark: "h-7", atlas: "text-base", sub: "text-[0.65rem]", firm: "text-[0.55rem]" },
    md: { mark: "h-9", atlas: "text-xl", sub: "text-xs", firm: "text-[0.6rem]" },
    lg: { mark: "h-14", atlas: "text-3xl", sub: "text-base", firm: "text-[0.7rem]" },
  }[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <AtlasMark className={scale.mark} />
      <div className="leading-none">
        <div
          className={cn(
            "font-semibold tracking-[0.08em] text-[var(--logo-blue)]",
            scale.atlas,
          )}
        >
          ATLAS
        </div>
        <div
          className={cn(
            "mt-0.5 font-normal tracking-[0.01em] text-[var(--logo-blue)]",
            scale.sub,
          )}
        >
          Investments
        </div>
        {showFirm && (
          <div
            className={cn(
              "mt-1.5 font-medium uppercase tracking-[0.14em] text-muted-foreground",
              scale.firm,
            )}
          >
            Integrated Barakah Wealth Advisory
          </div>
        )}
      </div>
    </div>
  );
}
