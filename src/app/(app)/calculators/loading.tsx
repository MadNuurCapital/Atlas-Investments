import { LoadingRegion, SkeletonCard, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </LoadingRegion>
  );
}
