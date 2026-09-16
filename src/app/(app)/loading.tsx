import { Page } from "@/components/app/page-head";
import {
  LoadingRegion,
  PageHeadSkeleton,
  StatStripSkeleton,
  PanelTableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <header className="h-14 border-b border-line" />
      <Page>
        <LoadingRegion label="Loading your overview">
          <PageHeadSkeleton />
          <StatStripSkeleton />
          <PanelTableSkeleton rows={4} />
        </LoadingRegion>
      </Page>
    </>
  );
}
