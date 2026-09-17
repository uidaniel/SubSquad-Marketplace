import "server-only";

import { env } from "@/lib/env";
import type { CampaignSlot } from "@/lib/domain";
import * as demo from "./demo-queries";
import * as live from "./supabase-queries";

/**
 * Where the app's data comes from.
 *
 * One switch, chosen once, at the only place in the codebase that knows both
 * implementations exist. Screens import from here and never learn whether they
 * are reading Postgres or fixtures — which is what lets the whole product be
 * demoed, reviewed and screenshotted without a database, and lets a pilot run
 * against one without touching a component.
 */
const impl = env.demoMode ? demo : live;

export const getCurrentOrg = () => impl.getCurrentOrg();
export const getCurrentUser = () => impl.getCurrentUser();
export const getSpaces = () => impl.getSpaces();
export const getSpace = (spaceId: string) => impl.getSpace(spaceId);

export const getBalance = (accountId: string) => impl.getBalance(accountId);
export const getWalletBalances = () => impl.getWalletBalances();
export const getOrgMoneySummary = () => impl.getOrgMoneySummary();
export const getTransactions = (limit?: number) => impl.getTransactions(limit);

export const getCampaign = (id: string) => impl.getCampaign(id);
export const getCampaignSummaries = () => impl.getCampaignSummaries();
export const getCampaignSummary = (id: string) => impl.getCampaignSummary(id);
export const getNeedsAction = () => impl.getNeedsAction();

export const getDealsForCampaign = (id: string) => impl.getDealsForCampaign(id);
export const getDeal = (id: string) => impl.getDeal(id);
export const getMessagesForCampaign = (id: string) => impl.getMessagesForCampaign(id);
export const getDraftsForCampaign = (id: string) => impl.getDraftsForCampaign(id);
export const getPendingMessageDrafts = () => impl.getPendingMessageDrafts();
export const getShortlist = (id: string) => impl.getShortlist(id);
export const getCreators = () => impl.getCreators();
export const getCreatorDetail = (creatorId: string) => impl.getCreatorDetail(creatorId);

/**
 * The escrow balance for a campaign.
 *
 * The demo module reaches it through a synthetic account id; the live one joins
 * on campaign_id. Callers should not know the difference.
 */
export async function getCampaignEscrow(campaignId: string) {
  if (env.demoMode) {
    const { escrowAccountFor } = await import("@/lib/demo/data");
    return demo.getBalance(escrowAccountFor(campaignId));
  }
  return live.getCampaignEscrow(campaignId);
}

/** "Now" — fixed in demo mode so screenshots are stable, real otherwise. */
export const NOW = env.demoMode ? demo.NOW : new Date();

/**
 * The deliverables a campaign is asking for.
 *
 * Several screens need the real slot count — the funding total, the shortlist
 * target, the campaign header. Each was computing it its own way or, in the
 * shortlist's case, using a number typed into the page.
 */
export async function getCampaignSlots(campaignId: string): Promise<CampaignSlot[]> {
  if (env.demoMode) {
    const { DEMO_SLOTS } = await import("@/lib/demo/data");
    return DEMO_SLOTS.filter((s) => s.campaignId === campaignId);
  }
  return live.getCampaignSlots(campaignId);
}
export const getTeam = () => impl.getTeam();
