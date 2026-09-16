import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { getNeedsAction } from "@/lib/data/queries";

export const metadata = { title: "Notifications" };

/**
 * What needs you.
 *
 * Deliberately not a feed of everything. The platform does most of its work
 * without asking — outreach, reminders, draft checks, payouts — and a
 * notification for each would bury the handful that actually need a decision.
 * So this is only what is blocked on a person, most urgent first.
 */
export default async function NotificationsPage() {
  const items = await getNeedsAction();

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-6">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Notifications
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-2">
          Only what needs you. Everything else is running on its own.
        </p>
      </header>

      {items.length === 0 ? (
        <Panel>
          <PanelBody className="py-14 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-ground">
              <Bell className="size-5 text-ink-3" />
            </span>
            <p className="mt-3 text-[15px] font-medium">Nothing waiting</p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Outreach, reminders and draft checks are running without you.
            </p>
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <Link key={`${item.campaignId}-${i}`} href={item.href} className="block">
              <Panel className="transition-colors hover:border-line-strong">
                <PanelBody className="flex items-start gap-3 py-4">
                  <Badge tone={item.tone} dot className="mt-0.5 shrink-0">
                    {item.label}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">
                      {item.detail}
                    </span>
                    <span className="block text-[12.5px] text-ink-2">
                      {item.campaignName}
                    </span>
                  </span>
                </PanelBody>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
