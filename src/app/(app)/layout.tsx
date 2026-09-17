import { Sidebar, type NavGroup } from "@/components/app/sidebar";
import {
  getCurrentOrg,
  getCurrentUser,
  getAllDeals,
  getNeedsAction,
  getOrgMoneySummary,
  getPendingMessageDrafts,
  getSpaces,
} from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { STAGE_META, stageOf } from "@/lib/deals/stages";

/**
 * The org shell.
 *
 * An agency and a brand share this layout but not this navigation: a brand has
 * one space and no margin, so showing it a "Clients" section would be showing
 * it a feature it can never use.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [org, user, spaces, money, needsAction, pendingDrafts, deals] =
    await Promise.all([
      getCurrentOrg(),
      getCurrentUser(),
      getSpaces(),
      getOrgMoneySummary(),
      getNeedsAction(),
      getPendingMessageDrafts(),
      getAllDeals(),
    ]);

  // Only the count that means somebody is waiting on a person. A badge that
  // counts everything is a badge nobody reads.
  const awaitingRate = deals.filter(
    (d) => STAGE_META[stageOf(d.status)].waitingOn === "you",
  ).length;

  const isAgency = org.type === "agency";

  const groups: NavGroup[] = [
    {
      label: "Account",
      items: [{ href: "/", label: "Overview", icon: "dashboard" }],
    },
    {
      label: "Work",
      items: [
        { href: "/campaigns", label: "Campaigns", icon: "campaigns" },
        {
          href: "/deals",
          label: "Deals",
          icon: "deals",
          count: awaitingRate || undefined,
        },
        {
          href: "/approvals",
          label: "Approvals",
          icon: "approvals",
          count: needsAction.length || undefined,
        },
        {
          href: "/outreach",
          label: "Outreach",
          icon: "outreach",
          count: pendingDrafts.length || undefined,
        },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/creators", label: "Creators", icon: "creators" },
        ...(isAgency
          ? ([{ href: "/spaces", label: "Clients", icon: "clients" }] as const)
          : []),
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/wallet", label: "Wallet", icon: "wallet" },
        { href: "/reports", label: "Reports", icon: "campaigns" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orgName={org.name}
        orgSubtitle={
          isAgency
            ? `Agency · ${spaces.length} client${spaces.length === 1 ? "" : "s"}`
            : "Brand account"
        }
        groups={groups}
        escrowKobo={money.escrowKobo}
        escrowNote={`${formatNaira(money.walletsKobo)} available in wallets`}
        userName={user.name}
        userRole={user.role === "owner" ? "Owner" : "Team"}
        showOps={isAgency}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}
