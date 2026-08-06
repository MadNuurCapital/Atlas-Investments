import {
  LoadingRegion,
  SkeletonCard,
  SkeletonForm,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <div className="grid gap-5 lg:grid-cols-[24rem_1fr]">
        <SkeletonForm fields={4} />
        <SkeletonCard lines={6} />
      </div>
    </LoadingRegion>
  );
}
