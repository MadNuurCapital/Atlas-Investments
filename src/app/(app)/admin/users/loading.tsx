import {
  LoadingRegion,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader action />
      <SkeletonTable rows={6} columns={5} />
    </LoadingRegion>
  );
}
