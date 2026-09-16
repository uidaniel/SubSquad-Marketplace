import { Page } from "@/components/app/page-head";
import {
  LoadingRegion,
  PageHeadSkeleton,
  PanelTableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <header className="h-14 border-b border-line" />
      <Page>
        <LoadingRegion label="Loading the creator index">
          <PageHeadSkeleton />
          <PanelTableSkeleton rows={8} columns={["26%", "14%", "14%", "16%", "15%", "15%"]} />
        </LoadingRegion>
      </Page>
    </>
  );
}
