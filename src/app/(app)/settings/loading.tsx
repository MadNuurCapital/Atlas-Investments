import {
  LoadingRegion,
  SkeletonCard,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <div className="grid max-w-3xl gap-5">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </div>
    </LoadingRegion>
  );
}
