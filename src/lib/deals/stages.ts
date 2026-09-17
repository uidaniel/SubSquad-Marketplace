import type { DealStatus } from "@/lib/domain";

/**
 * The pipeline a deal moves through.
 *
 * Fourteen statuses is the right number for a database and far too many for a
 * screen. An account exec does not think "is this deal in draft_submitted or
 * revision_requested" — they think "is anybody waiting on me". So statuses are
 * grouped into the stages a person actually works in, and the grouping lives
 * here rather than in the page, because the dashboard, the pipeline and the
 * creator's own list must not disagree about what stage means.
 */

export const STAGES = [
  "invited",
  "negotiating",
  "signing",
  "producing",
  "reviewing",
  "ready",
  "live",
  "paid",
  "closed",
] as const;

export type Stage = (typeof STAGES)[number];

const OF_STATUS: Record<DealStatus, Stage> = {
  invited: "invited",
  negotiating: "negotiating",
  accepted: "signing",
  awaiting_funding: "signing",
  partially_funded: "signing",
  contract_signed: "producing",
  draft_submitted: "reviewing",
  revision_requested: "reviewing",
  approved: "ready",
  published: "live",
  paid: "paid",
  declined: "closed",
  cancelled: "closed",
  disputed: "closed",
};

export function stageOf(status: DealStatus): Stage {
  return OF_STATUS[status];
}

/**
 * What each stage is, and who is holding it up.
 *
 * `waitingOn` is the useful column. A pipeline that only says where a deal is
 * lets everything sit; one that says whose move it is gets worked.
 */
export const STAGE_META: Record<
  Stage,
  { label: string; waitingOn: "you" | "creator" | "nobody"; blurb: string }
> = {
  invited: {
    label: "Invited",
    waitingOn: "creator",
    blurb: "Sent, not yet answered.",
  },
  negotiating: {
    label: "Negotiating",
    waitingOn: "you",
    blurb: "A creator has named a rate and is waiting on your answer.",
  },
  signing: {
    label: "Signing",
    waitingOn: "creator",
    blurb: "Rate agreed. Waiting on the creator to sign the contract.",
  },
  producing: {
    label: "Producing",
    waitingOn: "creator",
    blurb: "Signed and filming. Nothing for you to do until a draft arrives.",
  },
  reviewing: {
    label: "In review",
    waitingOn: "you",
    blurb: "A draft is waiting on your approval or your notes.",
  },
  ready: {
    label: "Ready to post",
    waitingOn: "creator",
    blurb: "Approved. The creator posts and pastes the link.",
  },
  live: {
    label: "Live",
    waitingOn: "nobody",
    blurb: "Published and being verified. Payment releases automatically.",
  },
  paid: {
    label: "Paid",
    waitingOn: "nobody",
    blurb: "Done. The creator has the money.",
  },
  closed: {
    label: "Closed",
    waitingOn: "nobody",
    blurb: "Declined, cancelled, or in dispute.",
  },
};
