import { Badge } from "@/components/ui/badge";
import type { CampaignStatus, DealStatus } from "@/lib/domain";

/**
 * Status, in the words a person would use.
 *
 * The database stores machine states; a screen should not. "shortlisting" is
 * what the row is, "Awaiting your approval" is what it means to the person
 * reading it — and the second is the one that gets acted on.
 */

type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "brand";

const CAMPAIGN_LABELS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  draft: { label: "Needs funding", tone: "warn" },
  funded: { label: "Funded", tone: "info" },
  shortlisting: { label: "Awaiting your approval", tone: "warn" },
  outreach: { label: "Inviting creators", tone: "info" },
  content: { label: "Content in review", tone: "info" },
  live: { label: "Live", tone: "ok" },
  completed: { label: "Complete", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const DEAL_LABELS: Record<DealStatus, { label: string; tone: Tone }> = {
  invited: { label: "Invited", tone: "info" },
  negotiating: { label: "Negotiating", tone: "warn" },
  accepted: { label: "Accepted", tone: "info" },
  declined: { label: "Declined", tone: "neutral" },
  awaiting_funding: { label: "Awaiting funding", tone: "warn" },
  partially_funded: { label: "Part funded", tone: "warn" },
  contract_signed: { label: "Contract signed", tone: "info" },
  draft_submitted: { label: "Draft to review", tone: "warn" },
  revision_requested: { label: "Revision sent", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  published: { label: "Published", tone: "ok" },
  paid: { label: "Paid", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  disputed: { label: "In dispute", tone: "danger" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, tone } = CAMPAIGN_LABELS[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const { label, tone } = DEAL_LABELS[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/**
 * The fraud score, shown with its number and a word.
 *
 * A bare number invites "is 74 good?"; the word answers it without the reader
 * having to learn the scale.
 */
export function ScoreBadge({ score }: { score: number }) {
  const tone: Tone = score >= 80 ? "ok" : score >= 60 ? "warn" : "danger";
  const word = score >= 80 ? "Cleared" : score >= 60 ? "Borderline" : "Excluded";
  return (
    <Badge tone={tone}>
      <span className="tabular-nums font-semibold">{score}</span>
      <span className="opacity-70">{word}</span>
    </Badge>
  );
}

export { CAMPAIGN_LABELS, DEAL_LABELS };
