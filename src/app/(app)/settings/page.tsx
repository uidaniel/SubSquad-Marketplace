import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Page, PageHead } from "@/components/app/page-head";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { getCurrentOrg, getCurrentUser, getSpaces, NOW } from "@/lib/data/queries";
import { formatBps } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [org, user, spaces] = await Promise.all([
    getCurrentOrg(),
    getCurrentUser(),
    getSpaces(),
  ]);

  return (
    <>
      <Topbar crumbs={[{ label: "Settings" }]} userName={user.name} />
      <Page className="max-w-[820px]">
        <PageHead
          title="Settings"
          subtitle={`${org.name} · ${org.type === "agency" ? "Agency" : "Brand"} account`}
          actions={
            org.verificationStatus === "verified" ? (
              <Badge tone="ok">
                <BadgeCheck className="size-3" /> Verified
              </Badge>
            ) : (
              <Badge tone="warn" dot>
                Awaiting verification
              </Badge>
            )
          }
        />

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>Company</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Registered name" htmlFor="name">
                <Input id="name" defaultValue={org.name} />
              </Field>
              <Field
                label="CAC number"
                hint="Checked against the register before you can fund a campaign."
                htmlFor="cac"
              >
                <Input id="cac" defaultValue={org.cacNumber ?? ""} placeholder="RC 1234567" />
              </Field>
            </PanelBody>
            <PanelFooter className="flex items-center justify-between gap-3">
              <span>
                {org.verifiedAt
                  ? `Verified ${formatDate(org.verifiedAt, NOW)}`
                  : "Not yet verified"}
              </span>
              <Button size="sm">Save changes</Button>
            </PanelFooter>
          </Panel>

          {org.type === "agency" && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Margin</PanelTitle>
              </PanelHeader>
              <PanelBody className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Default margin on new campaigns"
                  hint="Added on top of the creator fee. Your clients never see this figure, on any screen or report."
                  htmlFor="margin"
                >
                  <Select id="margin" defaultValue={String(org.defaultMarginBps ?? 1500)}>
                    {[1000, 1200, 1500, 2000, 2500].map((bps) => (
                      <option key={bps} value={bps}>
                        {formatBps(bps)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </PanelBody>
              <PanelFooter>
                Set per campaign as well — this is only the starting value.
              </PanelFooter>
            </Panel>
          )}

          <Panel>
            <PanelHeader
              action={
                <Button variant="outline" size="sm">
                  Invite a teammate
                </Button>
              }
            >
              <PanelTitle>Team</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-line">
              <li className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={user.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{user.name}</span>
                  <span className="block text-[12.5px] text-ink-3">{user.email}</span>
                </span>
                <Badge tone="neutral">{user.role}</Badge>
              </li>
            </ul>
            <PanelFooter>
              Owners and admins can approve messages and release money. Members can
              see everything but cannot move money.
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Client spaces</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-line">
              {spaces.map((space) => (
                <li key={space.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={space.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{space.name}</span>
                    <span className="block text-[12.5px] text-ink-3">
                      {space.category}
                    </span>
                  </span>
                  {space.isSelf && <Badge tone="info">Your own brand</Badge>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-ink-3" />
                <PanelTitle>Compliance</PanelTitle>
              </div>
            </PanelHeader>
            <PanelBody className="space-y-2.5 text-[13.5px] text-ink-2">
              <p>
                Every published post is checked for its ARCON disclosure before
                payment is released. Restricted categories — betting, alcohol,
                financial products, health — route through our ops team regardless
                of what the AI check returns.
              </p>
              <p>
                Creator data is processed under the NDPA. You are the controller;
                SubSquad is your processor, under the data-processing agreement
                signed at sign-up.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </Page>
    </>
  );
}
