import { logger, schedules } from "@trigger.dev/sdk";
import { requireServiceClient } from "@/lib/supabase/service";

/**
 * Releasing a creator-initiated deal when the brand goes quiet.
 *
 * A creator brought the deal in, delivered it, and posted it. If the brand then
 * stops replying, the old world leaves the creator unpaid indefinitely — which
 * is the exact failure this product exists to remove. Five days after a
 * published URL is submitted with no objection, the deal settles in the
 * creator's favour.
 *
 * It runs on a schedule rather than a timer per deal so that a deal created
 * while the worker was down is still picked up.
 */
export const autoConfirmPublished = schedules.task({
  id: "deal.auto-confirm",
  // Hourly: the window is measured in days, so the precision costs nothing and
  // a missed run is picked up by the next one.
  cron: "0 * * * *",
  maxDuration: 120,
  run: async () => {
    const db = requireServiceClient();

    const { data: due, error } = await db
      .from("deals")
      .select("id, creator_id, fee_kobo, platform_fee_bps, fee_paid_by, auto_confirm_at")
      .eq("status", "published")
      .not("auto_confirm_at", "is", null)
      .lte("auto_confirm_at", new Date().toISOString());

    if (error) throw new Error(`could not read due deals: ${error.message}`);

    if (!due?.length) {
      logger.info("Nothing due for auto-confirmation");
      return { confirmed: 0 };
    }

    // Each deal is settled through the same release path a person would use, so
    // an auto-confirmed deal is indistinguishable in the ledger from an
    // approved one — which is the point. The money rules do not get a shortcut
    // because nobody was watching.
    const { releaseDeal } = await import("@/lib/deals/release");

    let confirmed = 0;
    for (const deal of due) {
      try {
        await releaseDeal(deal.id, {
          memo: "Auto-confirmed: the brand did not respond within five days",
        });
        confirmed += 1;
      } catch (failure) {
        // One bad deal must not stop the rest from settling.
        logger.error("Could not auto-confirm", {
          dealId: deal.id,
          error: (failure as Error).message,
        });
      }
    }

    logger.info("Auto-confirmation finished", { due: due.length, confirmed });
    return { confirmed };
  },
});
