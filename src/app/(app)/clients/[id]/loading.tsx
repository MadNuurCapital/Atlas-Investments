import {
  LoadingRegion,
  SkeletonCard,
  SkeletonChart,
  SkeletonStats,
} from "@/components/ui/skeleton";

export default function Loading() {
  // The client layout already renders the name and tab strip, so this fills
  // only the panel below them — no second header, no jump when it lands.
  return (
    <LoadingRegion>
      <SkeletonStats />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonCard lines={6} />
      </div>
    </LoadingRegion>
  );
}
