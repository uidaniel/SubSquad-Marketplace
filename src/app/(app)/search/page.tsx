import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { getCampaignSummaries, getCreators, getSpaces } from "@/lib/data/queries";
import { formatNaira } from "@/lib/money";
import { formatCount } from "@/lib/utils";

export const metadata = { title: "Search" };

/**
 * One box, three kinds of answer.
 *
 * An account exec looking for something is looking for a campaign, a creator or
 * a client — not choosing a search mode first. Matching happens across all three
 * and the results are grouped, so the answer is one keystroke away rather than
 * one decision plus one keystroke.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  if (!query) {
    return (
      <Wrapper query="">
        <Panel>
          <PanelBody className="py-14 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-ground">
              <Search className="size-5 text-ink-3" />
            </span>
            <p className="mt-3 text-[15px] font-medium">Search your account</p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Campaigns, creators and clients. Start typing in the box above.
            </p>
          </PanelBody>
        </Panel>
      </Wrapper>
    );
  }

  const [campaigns, creators, spaces] = await Promise.all([
    getCampaignSummaries(),
    getCreators(),
    getSpaces(),
  ]);

  // The box says "campaigns, creators and clients". It searched two of them.
  const matchedSpaces = spaces.filter(
    (s) =>
      s.name.toLowerCase().includes(query) ||
      (s.category ?? "").toLowerCase().includes(query),
  );

  const matchedCampaigns = campaigns.filter(
    (c) =>
      c.campaign.name.toLowerCase().includes(query) ||
      c.campaign.endBrandName.toLowerCase().includes(query),
  );

  const matchedCreators = creators.filter(
    ({ creator, profile }) =>
      creator.displayName.toLowerCase().includes(query) ||
      creator.handle.toLowerCase().includes(query) ||
      (profile?.categoryTags ?? []).some((t) => t.toLowerCase().includes(query)),
  );

  const total =
    matchedCampaigns.length + matchedCreators.length + matchedSpaces.length;

  return (
    <Wrapper query={q ?? ""}>
      {total === 0 ? (
        <Panel>
          <PanelBody className="py-14 text-center">
            <p className="text-[15px] font-medium">
              Nothing matches “{q}”
            </p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Try a campaign name, a creator handle, or a client.
            </p>
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-4">
          {matchedCampaigns.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>
                  Campaigns · {matchedCampaigns.length}
                </PanelTitle>
              </PanelHeader>
              <div>
                {matchedCampaigns.map(({ campaign, escrowHeldKobo }) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0 hover:bg-ground"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">
                        {campaign.name}
                      </span>
                      <span className="block text-[12.5px] text-ink-2">
                        {campaign.endBrandName}
                      </span>
                    </span>
                    <Badge tone="neutral">{campaign.status}</Badge>
                    <span className="shrink-0 text-[13px] tabular-nums text-ink-2">
                      {formatNaira(escrowHeldKobo)}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}

          {matchedSpaces.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Clients · {matchedSpaces.length}</PanelTitle>
              </PanelHeader>
              <div>
                {matchedSpaces.map((space) => (
                  <Link
                    key={space.id}
                    href="/spaces"
                    className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0 hover:bg-ground"
                  >
                    <Avatar name={space.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">{space.name}</span>
                      {space.category && (
                        <span className="block text-[12.5px] text-ink-2">{space.category}</span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}

          {matchedCreators.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Creators · {matchedCreators.length}</PanelTitle>
              </PanelHeader>
              <div>
                {matchedCreators.slice(0, 20).map(({ creator, profile, score }) => (
                  <Link
                    key={creator.id}
                    href={`/creators/${creator.id}`}
                    className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0 hover:bg-ground"
                  >
                    <Avatar name={creator.displayName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">
                        {creator.displayName}
                      </span>
                      <span className="block text-[12.5px] text-ink-2">
                        @{creator.handle}
                        {profile && ` · ${formatCount(profile.followers)} on ${creator.primaryPlatform}`}
                      </span>
                    </span>
                    {score && (
                      <Badge tone={score.fraudScore >= 60 ? "ok" : "danger"}>
                        {score.fraudScore}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </Wrapper>
  );
}

function Wrapper({
  query,
  children,
}: {
  query: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-6">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {query ? `Results for “${query}”` : "Search"}
        </h1>
      </header>
      {children}
    </div>
  );
}
