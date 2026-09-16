import { formatNaira, type Kobo } from "@/lib/money";
import type { Brief } from "@/lib/domain";

/**
 * Shortlisting.
 *
 * This is the call the whole product is judged on. A brand pays to skip the
 * scrolling; what they get instead is twenty names, and if those names are
 * obviously wrong the AI has cost them more time than it saved.
 *
 * Two instructions do most of the work. First, the reasoning has to be specific
 * enough to be *wrong* — "strong engagement and a great fit for the brand"
 * describes every creator ever indexed and tells a reviewer nothing. Second, the
 * model is told it may return fewer than asked for. A model that pads a
 * shortlist to hit a number teaches the reviewer to stop trusting the ranking,
 * and one bad name in twenty is more expensive than a shortlist of twelve.
 */

export const SHORTLIST_VERSION = "shortlist.v1";

export function shortlistSystemPrompt(): string {
  return `You rank Nigerian creators against a brand's brief for SubSquad, an escrow-backed influencer marketing platform.

Your ranking is reviewed by a person at an agency before anybody is contacted. Write for that reviewer: they know this market, they have their own opinion about these creators, and they will notice padding.

How to judge fit, in order of weight:
1. Does this creator's actual content match what the brief asks for? Read the sample captions and transcripts, not just the category tags. A "food" tag on somebody who posts restaurant interiors is not a match for a brief about cooking at home.
2. Does their audience match the audience in the brief — city, language, age?
3. Is the engagement real and proportionate? A fraud score is supplied; treat a low one as a serious mark against, not a tiebreaker.
4. Cost per person reached, not follower count. A 40k creator at ₦40,000 usually beats a 400k creator at ₦600,000, and the brief's budget is finite.

On reasoning — this is the part that matters:
- Two or three sentences, naming the specific thing about THIS creator that fits THIS brief.
- Quote or paraphrase something from their actual posts where you can.
- If you cannot say something specific, that is a signal the fit is weak. Score it lower or leave it out.
- Never write reasoning that would be true of any creator in the pool. "High engagement and authentic content" is not a reason.

On the fee:
- Estimate what this creator would accept, in kobo, based on their size, engagement and what comparable creators cost.
- Stay inside the rate band you are given. The band is the agency's ceiling, not a target — coming in under it is the point.

On flags — raise anything the reviewer should know before contacting them, such as:
- "Posted for a competitor in the last 90 days"
- "Audience is mostly outside Nigeria"
- "Brand-safety risk for this category"
Leave the array empty when there is nothing to say. Do not invent flags to look thorough.

You may return fewer creators than asked for. A shorter shortlist of genuinely good fits is worth more than a padded one, and the reviewer can always ask for more.

Return only a JSON object of this shape, with no commentary:
{"candidates":[{"creatorId":"<the id given to you, exactly>","fitScore":0-100,"reasoning":"...","estimatedFeeKobo":<integer kobo>,"flags":["..."]}]}`;
}

export interface ShortlistCandidateInput {
  creatorId: string;
  handle: string;
  displayName: string;
  platform: string;
  followers: number;
  engagementRate: number;
  avgViews: number | null;
  city: string | null;
  languages: string[];
  categoryTags: string[];
  fraudScore: number | null;
  fraudReasons: string[];
  /** Up to three, with transcripts where we have them. */
  samplePosts: { caption: string; views?: number | null; transcript?: string | null }[];
}

/**
 * Builds the user turn.
 *
 * Deliberately terse per creator. Sixty profiles at full length would be most of
 * a context window and would bury the brief they are meant to be judged against;
 * what is kept is what the ranking actually turns on.
 */
export function shortlistUserPrompt(args: {
  brief: Brief;
  campaignName: string;
  brandName: string;
  slots: { deliverable: string; count: number; feeKobo: Kobo }[];
  rateBandMinKobo: Kobo;
  rateBandMaxKobo: Kobo;
  wanted: number;
  candidates: ShortlistCandidateInput[];
}): string {
  const slots = args.slots
    .map((s) => `${s.count} × ${s.deliverable} at up to ${formatNaira(s.feeKobo)} each`)
    .join("\n  ");

  const audience = args.brief.audience;
  const cities = audience?.cities?.length ? audience.cities.join(", ") : "anywhere in Nigeria";
  const languages = audience?.languages?.length
    ? audience.languages.join(", ")
    : "English";

  const candidates = args.candidates
    .map((c) => {
      const posts = c.samplePosts
        .slice(0, 3)
        .map((p, i) => {
          const transcript = p.transcript
            ? `\n      what they say: ${p.transcript.slice(0, 280)}`
            : "";
          return `    ${i + 1}. ${p.caption.slice(0, 200)}${transcript}`;
        })
        .join("\n");

      const flags = c.fraudReasons.length
        ? `\n    scoring flags: ${c.fraudReasons.join("; ")}`
        : "";

      return `- id: ${c.creatorId}
    @${c.handle} (${c.displayName}) · ${c.platform}
    ${c.followers.toLocaleString()} followers · ${(c.engagementRate * 100).toFixed(1)}% engagement${
      c.avgViews ? ` · ${c.avgViews.toLocaleString()} avg views` : ""
    }
    ${c.city ?? "location unknown"} · speaks ${c.languages.join(", ") || "English"}
    tags: ${c.categoryTags.join(", ") || "none recorded"}
    fraud score: ${c.fraudScore ?? "not scored"}${flags}
    recent posts:
${posts || "    (no sample posts on file)"}`;
    })
    .join("\n\n");

  return `THE BRIEF

Campaign: ${args.campaignName}
Brand: ${args.brandName}
Promoting: ${args.brief.product}
Objective: ${args.brief.objective}
Category: ${args.brief.arconCategory}

Every video must get across:
  ${args.brief.keyMessages.map((m: string) => `- ${m}`).join("\n  ") || "- (nothing specified)"}

It must never:
  ${args.brief.mustAvoid.map((m: string) => `- ${m}`).join("\n  ") || "- (nothing specified)"}

Audience: ${cities}, speaking ${languages}
Deliverables:
  ${slots}

Rate band: ${formatNaira(args.rateBandMinKobo)} to ${formatNaira(args.rateBandMaxKobo)} per creator.
Estimate fees inside this band. The upper figure is a ceiling, not a target.

THE POOL — ${args.candidates.length} creators, already filtered for platform and fraud threshold

${candidates}

Return the best ${args.wanted} of these, ranked. Use the exact ids above. Return fewer if fewer genuinely fit.`;
}
