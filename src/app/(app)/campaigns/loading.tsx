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
        <LoadingRegion label="Loading campaigns">
          <PageHeadSkeleton />
          <PanelTableSkeleton rows={6} columns={["30%", "18%", "16%", "18%", "18%"]} />
        </LoadingRegion>
      </Page>
    </>
  );
}
