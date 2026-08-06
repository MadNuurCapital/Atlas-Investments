import {
  LoadingRegion,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader action />
      <SkeletonTable rows={9} columns={6} />
    </LoadingRegion>
  );
}
