import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import creators · Ops" };

const COLUMNS = [
  ["handle", "Required. Without the @.", "chideraskits"],
  ["platform", "Required. tiktok, instagram, youtube or x.", "tiktok"],
  ["display_name", "Required.", "Chidera Okonkwo"],
  ["followers", "Required. Digits only.", "128400"],
  ["engagement_rate", "Required. A percentage or a fraction — 7.4 or 0.074.", "7.4"],
  ["avg_likes", "Used by the fraud rules.", "9400"],
  ["avg_comments", "Used by the fraud rules.", "310"],
  ["following", "Used by the fraud rules.", "890"],
  ["phone", "Nigerian format. Needed for WhatsApp outreach.", "0803 000 4471"],
  ["email", "Used when there is no phone.", "hello@chidera.ng"],
  ["city", "", "Lagos"],
  ["category_tags", "Separated by semicolons.", "skits;comedy"],
  ["bio", "Scanned by the fraud rules for promo-account language.", ""],
  ["contact_source", "bio, linkinbio, manual or referral.", "bio"],
] as const;

/**
 * Bringing the first creators in.
 *
 * The index starts as a spreadsheet somebody built by hand, because there is no
 * API that lists Nigerian creators worth working with. This is the door for it.
 *
 * Every row is scored on import and nothing is contacted by importing — an
 * import builds the index, outreach is a separate, deliberate act. That
 * distinction matters: a mistake here should never reach somebody's phone.
 */
export default function ImportCreatorsPage() {
  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>Import creators from a CSV</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <ImportForm />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>What the file should contain</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            One creator per row, with a header row naming the columns. Order does
            not matter and unknown columns are ignored, so a working spreadsheet
            can usually be exported as-is.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-2">
                  <th className="py-2 pr-4 font-medium">Column</th>
                  <th className="py-2 pr-4 font-medium">Notes</th>
                  <th className="py-2 font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map(([name, note, example]) => (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 font-mono text-[12.5px]">{name}</td>
                    <td className="py-2 pr-4 text-ink-2">{note || "—"}</td>
                    <td className="py-2 font-mono text-[12px] text-ink-3">
                      {example || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rounded-[var(--radius-sm)] bg-ground px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
            Importing contacts nobody. Every row is fraud-scored on the way in,
            and anything below 60 is kept but never reaches a shortlist. Outreach
            is a separate step you trigger from a campaign.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
