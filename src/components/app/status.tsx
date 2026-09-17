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

/**
 * Colour says the phase; the label says the state.
 *
 * Eight statuses shared three tones, so Invited, Accepted and Contract signed
 * were the same blue and a table of deals read as one undifferentiated block.
 * There are only six tones and fourteen statuses, so colour cannot carry the
 * whole distinction — but it can carry the thing a person scans for, which is
 * whose move it is.
 *
 * So the tone follows the stage: warn when it is waiting on you, brand when it
 * is waiting on the creator to do something specific, info while they are
 * working, ok once it is live or paid, neutral when it is over. Two rows with
 * the same colour always mean the same kind of thing.
 */
const DEAL_LABELS: Record<DealStatus, { label: string; tone: Tone }> = {
  // Waiting on the creator to answer.
  invited: { label: "Invited", tone: "neutral" },
  // Waiting on you.
  negotiating: { label: "Wants a different rate", tone: "warn" },
  // Agreed, waiting on them to sign.
  accepted: { label: "Needs to sign", tone: "brand" },
  awaiting_funding: { label: "Awaiting funding", tone: "warn" },
  partially_funded: { label: "Part funded", tone: "warn" },
  // Signed and working.
  contract_signed: { label: "Filming", tone: "info" },
  // Waiting on you.
  draft_submitted: { label: "Draft to review", tone: "warn" },
  // Waiting on them.
  revision_requested: { label: "Fixing a revision", tone: "brand" },
  approved: { label: "Ready to post", tone: "brand" },
  // Done, or nearly.
  published: { label: "Live", tone: "ok" },
  paid: { label: "Paid", tone: "ok" },
  // Over.
  declined: { label: "Declined", tone: "neutral" },
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
