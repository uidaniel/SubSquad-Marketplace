import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { getCurrentUser, getWalletBalances } from "@/lib/data/queries";
import { DepositForm } from "./deposit-form";

export const metadata = { title: "Add funds" };

export default async function DepositPage() {
  const [user, wallets] = await Promise.all([getCurrentUser(), getWalletBalances()]);

  return (
    <>
      <Topbar
        crumbs={[{ label: "Wallet", href: "/wallet" }, { label: "Add funds" }]}
        userName={user.name}
      />
      <Page className="max-w-[640px]">
        <PageHead
          title="Add funds"
          subtitle="Money sits in a client's wallet until you fund a campaign with it. Nobody is contacted before that happens."
        />

        <Panel>
          <PanelHeader>
            <PanelTitle>Record a bank transfer</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <DepositForm
              spaces={wallets.map(({ space, availableKobo }) => ({
                id: space.id,
                name: space.name,
                availableKobo,
              }))}
            />
          </PanelBody>
        </Panel>

        <Panel className="mt-4">
          <PanelBody className="text-[13px] leading-relaxed text-ink-2">
            <p className="font-medium text-ink">Paying by card instead?</p>
            <p className="mt-1">
              Card and USSD payments arrive through Paystack and appear in the
              wallet on their own — there is nothing to record by hand. This form
              is for the bank transfers most Nigerian clients actually use.
            </p>
          </PanelBody>
        </Panel>
      </Page>
    </>
  );
}
