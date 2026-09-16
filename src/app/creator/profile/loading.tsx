import { CardListSkeleton, LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading your profile">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-4 h-28 w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="mt-7 h-3 w-24" />
      <div className="mt-2.5">
        <CardListSkeleton count={2} />
      </div>
    </LoadingRegion>
  );
}
