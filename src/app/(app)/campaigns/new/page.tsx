import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { getCurrentOrg, getCurrentUser, getWalletBalances } from "@/lib/data/queries";
import { NewCampaignForm } from "./new-campaign-form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const [org, user, wallets] = await Promise.all([
    getCurrentOrg(),
    getCurrentUser(),
    getWalletBalances(),
  ]);

  return (
    <>
      <Topbar
        crumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: "New" }]}
        userName={user.name}
      />
      <Page className="max-w-[760px]">
        <PageHead
          title="New campaign"
          subtitle="Write the brief the way you would explain it to a person. The AI turns it into the checks each draft is measured against — so the clearer it is here, the fewer revisions later."
        />
        <NewCampaignForm
          spaces={wallets.map(({ space, availableKobo }) => ({
            id: space.id,
            name: space.name,
            availableKobo,
          }))}
          defaultMarginBps={org.defaultMarginBps ?? 1500}
          isAgency={org.type === "agency"}
        />
      </Page>
    </>
  );
}
