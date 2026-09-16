import { Page } from "@/components/app/page-head";
import {
  LoadingRegion,
  PageHeadSkeleton,
  StatStripSkeleton,
  PanelTableSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <header className="h-14 border-b border-line" />
      <Page>
        <LoadingRegion label="Loading this campaign">
          <PageHeadSkeleton />
          <StatStripSkeleton />
          <div className="mb-6 flex gap-4 border-b border-line pb-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          <PanelTableSkeleton rows={5} />
        </LoadingRegion>
      </Page>
    </>
  );
}
