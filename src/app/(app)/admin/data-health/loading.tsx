import {
  LoadingRegion,
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <SkeletonStats count={4} />
      <div className="mt-5">
        <SkeletonTable rows={8} columns={5} />
      </div>
    </LoadingRegion>
  );
}
