import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The Atlas Investments logo.
 *
 * This is the firm's own artwork — `public/brand/atlas-logo.png`, taken from
 * the supplied 4000 x 4000 export, background keyed out and cropped to its
 * real content. See `public/brand/README.md` for how, and why a global
 * "make white transparent" would have destroyed the mark.
 *
 * Light mode renders it directly on the page. Dark mode puts it on a white
 * plate: the wordmark is Atlas Blue, which reaches only about 2.9:1 against
 * the dark background — legible but dim, and dimming a firm's mark is worse
 * than plating it. Recolouring someone's brand is not ours to do.
 *
 * If a true vector original ever arrives — real paths, flat fills — swap the
 * <Image> for an inline SVG that takes its fill from `--logo-blue`, and the
 * plate can go. Nothing else needs to change.
 */

const LOGO_WIDTH = 1306;
const LOGO_HEIGHT = 376;

const SIZES = {
  sm: { h: 26, firm: "text-[0.5rem]", gap: "mt-1" },
  md: { h: 34, firm: "text-[0.55rem]", gap: "mt-1.5" },
  lg: { h: 52, firm: "text-[0.65rem]", gap: "mt-2" },
} as const;

export function AtlasLogo({
  className,
  showFirm = true,
  size = "md",
}: {
  className?: string;
  showFirm?: boolean;
  size?: keyof typeof SIZES;
}) {
  const scale = SIZES[size];
  const width = Math.round((scale.h * LOGO_WIDTH) / LOGO_HEIGHT);

  return (
    <div className={cn("inline-flex flex-col items-start", className)}>
      {/* Padding is present in both themes so the plate appearing in dark
          mode does not shift the layout around it. */}
      <div className="rounded-md p-1.5 dark:bg-white">
        <Image
          src="/brand/atlas-logo.png"
          alt="Atlas Investments"
          width={width}
          height={scale.h}
          style={{ height: scale.h, width: "auto" }}
          priority
        />
      </div>

      {showFirm && (
        <div
          className={cn(
            "font-medium uppercase tracking-[0.14em] text-muted-foreground",
            scale.gap,
            scale.firm,
          )}
        >
          Integrated Barakah Wealth Advisory
        </div>
      )}
    </div>
  );
}

/**
 * Logo for client-facing output — the snapshot card and the printed PDF.
 *
 * Always light, regardless of the advisor's theme, and `unoptimized` so the
 * image is embedded at full quality rather than served through the optimiser,
 * which a print or a screenshot may not wait for.
 */
export function AtlasLogoPrint({ height = 54 }: { height?: number }) {
  const width = Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT);
  return (
    <div>
      <Image
        src="/brand/atlas-logo.png"
        alt="Atlas Investments"
        width={width}
        height={height}
        style={{ height, width: "auto" }}
        priority
        unoptimized
      />
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "#4a5f73",
        }}
      >
        Integrated Barakah Wealth Advisory
      </div>
    </div>
  );
}
