import {
  LoadingRegion,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader action />
      <SkeletonTable rows={8} columns={5} />
    </LoadingRegion>
  );
}
