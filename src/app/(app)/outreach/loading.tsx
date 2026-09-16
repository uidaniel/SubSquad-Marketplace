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
        <LoadingRegion label="Loading the outreach queue">
          <PageHeadSkeleton />
          <PanelTableSkeleton rows={3} columns={["100%"]} />
        </LoadingRegion>
      </Page>
    </>
  );
}
