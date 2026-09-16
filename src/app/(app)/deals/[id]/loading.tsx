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
        <LoadingRegion label="Loading this deal">
          <PageHeadSkeleton withActions={false} />
          <StatStripSkeleton />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <PanelTableSkeleton rows={4} columns={["100%"]} />
            <PanelTableSkeleton rows={4} columns={["60%", "40%"]} />
          </div>
        </LoadingRegion>
      </Page>
    </>
  );
}
