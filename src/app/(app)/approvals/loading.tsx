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
        <LoadingRegion label="Loading what needs you">
          <PageHeadSkeleton withActions={false} />
          <PanelTableSkeleton rows={4} columns={["70%", "30%"]} />
        </LoadingRegion>
      </Page>
    </>
  );
}
