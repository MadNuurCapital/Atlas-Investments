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
        <SkeletonForm fields={8} />
        <SkeletonForm fields={7} />
        <SkeletonForm fields={2} />
      </div>
    </LoadingRegion>
  );
}
