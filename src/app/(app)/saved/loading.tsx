import {
  LoadingRegion,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <SkeletonTable rows={6} columns={4} />
    </LoadingRegion>
  );
}
