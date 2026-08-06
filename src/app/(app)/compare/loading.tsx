import {
  LoadingRegion,
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <SkeletonCard lines={2} />
      <div className="mt-5">
        <SkeletonTable rows={7} columns={4} />
      </div>
    </LoadingRegion>
  );
}
