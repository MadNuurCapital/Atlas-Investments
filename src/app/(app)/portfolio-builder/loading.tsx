import {
  LoadingRegion,
  SkeletonCard,
  SkeletonChart,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonPageHeader />
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <SkeletonCard lines={6} />
        <SkeletonChart />
      </div>
    </LoadingRegion>
  );
}
