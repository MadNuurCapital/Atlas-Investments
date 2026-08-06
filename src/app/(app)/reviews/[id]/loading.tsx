import {
  LoadingRegion,
  SkeletonForm,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <div className="grid gap-5">
        <SkeletonForm fields={6} />
        <SkeletonForm fields={4} />
      </div>
    </LoadingRegion>
  );
}
