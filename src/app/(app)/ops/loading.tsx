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
        <LoadingRegion label="Loading the ops console">
          <PageHeadSkeleton withActions={false} />
          <StatStripSkeleton />
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <PanelTableSkeleton rows={4} columns={["70%", "30%"]} />
            <PanelTableSkeleton rows={6} columns={["70%", "30%"]} />
          </div>
        </LoadingRegion>
      </Page>
    </>
  );
}
