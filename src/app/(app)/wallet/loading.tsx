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
        <LoadingRegion label="Loading your wallet">
          <PageHeadSkeleton />
          <StatStripSkeleton />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
            <PanelTableSkeleton rows={5} columns={["60%", "40%"]} />
            <PanelTableSkeleton rows={6} />
          </div>
        </LoadingRegion>
      </Page>
    </>
  );
}
