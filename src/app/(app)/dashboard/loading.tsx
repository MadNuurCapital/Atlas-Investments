import {
  LoadingRegion,
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonStats,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader action />
      <SkeletonStats />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </LoadingRegion>
  );
}
