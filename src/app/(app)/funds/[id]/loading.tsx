import {
  LoadingRegion,
  SkeletonCard,
  SkeletonChart,
  SkeletonPageHeader,
  SkeletonStats,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader action />
      <SkeletonStats count={4} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonCard lines={7} />
      </div>
    </LoadingRegion>
  );
}
