import { getCreatorDeals, getCurrentCreator } from "@/lib/data/creator-queries";
import { NewDealForm } from "./new-deal-form";

export const metadata = { title: "New deal" };

/** A creator can hold five unfunded deals at once, so the flow cannot be used
 *  to spray speculative contracts at brands. */
const UNFUNDED_CAP = 5;

export default async function NewDealPage() {
  const creator = await getCurrentCreator();
  const deals = await getCreatorDeals(creator.id);
  const unfunded = deals.filter((d) =>
    ["awaiting_funding", "partially_funded"].includes(d.deal.status),
  ).length;

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        Bring your own deal
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
        Already agreed something with a brand? Put it through SubSquad and we hold
        their money until your post is live — so you are never chasing an invoice
        again.
      </p>

      <div className="mt-6">
        <NewDealForm unfundedCount={unfunded} cap={UNFUNDED_CAP} />
      </div>
    </>
  );
}
