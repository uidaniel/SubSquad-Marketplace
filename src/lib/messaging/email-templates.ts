import { formatNaira, type Kobo } from "@/lib/money";

/**
 * Email, for creators.
 *
 * These are not marketing emails and must not look like any. The person opening
 * one has been scammed before, or knows somebody who has, and every real brand
 * deal they have ever been offered arrived looking exactly like a fake one. So
 * the design rules here are the opposite of the usual:
 *
 *   · The fee is the largest thing on the page, above everything else. It is
 *     the only fact that separates this from a fake, and burying it under a
 *     paragraph of warmth reads as a setup.
 *   · No images, no logos loaded from a server, no tracking pixel. Image-heavy
 *     mail lands in Promotions, images are blocked by default on most Android
 *     mail apps, and a layout that collapses without them looks broken.
 *   · One link, one action. Two competing buttons in a message about money
 *     reads as a phishing attempt.
 *   · Nothing is asked for. We never request a password, a bank detail or a
 *     code by email, and the footer says so, because that sentence is what
 *     makes the next email from an actual scammer fail.
 *
 * Tables and inline styles throughout. This is not nostalgia: Gmail strips
 * <style> blocks, Outlook ignores flexbox, and a creator on a 2019 Android
 * reading in the Gmail app gets none of the CSS a modern layout depends on.
 */

const INK = "#141414";
const INK_2 = "#6a6a6a";
const INK_3 = "#9c9c9c";
const LINE = "#e7e5e0";
const GROUND = "#f5f5f3";
const BRAND = "#ce3409";
const OK = "#11764c";
const OK_SOFT = "#e8f3ee";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface EmailContent {
  subject: string;
  /** Sent alongside the HTML. Some clients show it, and spam filters read it. */
  text: string;
  html: string;
}

/* ==========================================================================
   Shell
   ========================================================================== */

function shell(args: {
  preheader: string;
  body: string;
  footerNote?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>SubSquad</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};font-family:${FONT};-webkit-font-smoothing:antialiased;">

<!-- The line shown in the inbox list beside the subject. Without it, clients
     pull the first words of the body, which here is the brand name and reads
     like spam. Hidden in the message itself. -->
<div style="display:none;font-size:1px;color:${GROUND};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${args.preheader}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

        <tr>
          <td style="padding:0 4px 16px;">
            <span style="font-size:16px;font-weight:700;color:${INK};letter-spacing:-0.02em;">SubSquad</span>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:28px 24px;">
${args.body}
          </td>
        </tr>

        <tr>
          <td style="padding:20px 4px 0;">
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${INK_3};">
              ${args.footerNote ?? "SubSquad holds the money for brand deals in Nigeria and pays creators when their post goes live."}
            </p>
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${INK_3};">
              <strong style="color:${INK_2};">We will never ask you for a password, a bank PIN, or a code by email.</strong>
              Anybody who does is not us.
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:${INK_3};">
              SubSquad Technologies Ltd · Victoria Island, Lagos
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** The one action. A single button, wide enough for a thumb. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 0;">
  <tr>
    <td align="center" style="border-radius:8px;background:${BRAND};">
      <a href="${href}"
         style="display:block;padding:15px 24px;font-family:${FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

/** A labelled row. Tables, because Outlook will not align anything else. */
function row(label: string, value: string, last = false): string {
  return `<tr>
  <td style="padding:11px 0;${last ? "" : `border-bottom:1px solid ${LINE};`}font-size:14px;color:${INK_2};">${label}</td>
  <td align="right" style="padding:11px 0;${last ? "" : `border-bottom:1px solid ${LINE};`}font-size:14px;font-weight:600;color:${INK};">${value}</td>
</tr>`;
}

/* ==========================================================================
   The invite
   ========================================================================== */

export interface InviteEmailArgs {
  creatorFirstName: string;
  brandName: string;
  deliverable: string;
  feeKobo: Kobo;
  deadline: string;
  inviteUrl: string;
  /** Where to reply to opt out. Shown, not hidden in a header. */
  optOutNote?: string;
}

/**
 * The first email a creator receives.
 *
 * Everything above the fold answers "is this real": the fee, and that it is
 * already held. The brand's name comes after, because a name they do not
 * recognise is not evidence of anything.
 */
export function inviteEmail(args: InviteEmailArgs): EmailContent {
  const fee = formatNaira(args.feeKobo);

  const body = `
            <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${INK};">
              Hi ${args.creatorFirstName},
            </p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${INK_2};">
              ${args.brandName} would like to work with you. The money is already paid in.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${GROUND};border-radius:10px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 4px;font-size:13px;color:${INK_2};">You will be paid</p>
                  <p style="margin:0;font-size:34px;line-height:1.1;font-weight:700;color:${INK};letter-spacing:-0.03em;">
                    ${fee}
                  </p>
                  <p style="margin:12px 0 0;">
                    <span style="display:inline-block;background:${OK_SOFT};color:${OK};border-radius:99px;padding:6px 12px;font-size:13px;font-weight:600;">
                      Already held in escrow
                    </span>
                  </p>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
              ${row("Brand", args.brandName)}
              ${row("What they want", args.deliverable)}
              ${row("Due", args.deadline)}
              ${row("Paid", "Within 7 days of your post going live", true)}
            </table>

            ${button(args.inviteUrl, `See the deal`)}

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${INK_2};">
              You can accept, ask for more, or say no. Nothing happens until you choose.
            </p>

            <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${INK_3};">
              SubSquad holds the fee, not ${args.brandName}. It is released to you once your
              post is live and verified — and if the brand pulls out after you have delivered,
              you are paid anyway.
            </p>`;

  const text = `Hi ${args.creatorFirstName},

${args.brandName} would like to work with you.

You will be paid: ${fee} — already held in escrow.
What they want: ${args.deliverable}
Due: ${args.deadline}
Paid: within 7 days of your post going live

See the deal: ${args.inviteUrl}

You can accept, ask for more, or say no. Nothing happens until you choose.

SubSquad holds the fee, not ${args.brandName}. It is released once your post is
live and verified.

We will never ask you for a password, a bank PIN, or a code by email.
${args.optOutNote ?? "Reply STOP to this email and we will not contact you again."}`;

  return {
    // Names the money and the brand. A creator scanning an inbox decides on
    // this line alone, and "opportunity" is what every fake one says.
    subject: `${args.brandName} — ${fee} for ${args.deliverable}`,
    text,
    html: shell({
      preheader: `${fee} is already held in escrow. Due ${args.deadline}.`,
      body,
      footerNote:
        args.optOutNote ??
        "Reply STOP to this email and we will not contact you again.",
    }),
  };
}

/* ==========================================================================
   Revision requested
   ========================================================================== */

export function revisionEmail(args: {
  creatorFirstName: string;
  brandName: string;
  feeKobo: Kobo;
  notes: string;
  dealUrl: string;
}): EmailContent {
  const body = `
            <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${INK};">
              Hi ${args.creatorFirstName},
            </p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${INK_2};">
              Almost there — one change is needed before ${args.brandName} can approve your post.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${GROUND};border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${INK_2};">What to change</p>
                  <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">${args.notes}</p>
                </td>
              </tr>
            </table>

            ${button(args.dealUrl, "Send a new version")}

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${INK_2};">
              Your ${formatNaira(args.feeKobo)} is still held. This does not affect it.
            </p>`;

  return {
    subject: `One change needed — ${args.brandName}`,
    text: `Hi ${args.creatorFirstName},

Almost there. One change is needed before ${args.brandName} can approve your post.

What to change: ${args.notes}

Send a new version: ${args.dealUrl}

Your ${formatNaira(args.feeKobo)} is still held. This does not affect it.`,
    html: shell({
      preheader: "One change, then you are done.",
      body,
    }),
  };
}

/* ==========================================================================
   Paid
   ========================================================================== */

export function paidEmail(args: {
  creatorFirstName: string;
  brandName: string;
  amountKobo: Kobo;
  bankName: string;
  accountLast4: string;
  walletUrl: string;
}): EmailContent {
  const amount = formatNaira(args.amountKobo);

  const body = `
            <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${INK};">
              Hi ${args.creatorFirstName},
            </p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${INK_2};">
              Your money for the ${args.brandName} deal has gone out.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${OK_SOFT};border-radius:10px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 4px;font-size:13px;color:${OK};">Sent to your bank</p>
                  <p style="margin:0;font-size:32px;line-height:1.1;font-weight:700;color:${INK};letter-spacing:-0.03em;">
                    ${amount}
                  </p>
                  <p style="margin:10px 0 0;font-size:13px;color:${INK_2};">
                    ${args.bankName} ending ${args.accountLast4}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${INK_2};">
              Most banks show it within minutes, some take a few hours. If it has
              not arrived by tomorrow, reply to this email and a person will chase it.
            </p>

            ${button(args.walletUrl, "See your payments")}`;

  return {
    subject: `${amount} sent — ${args.brandName}`,
    text: `Hi ${args.creatorFirstName},

Your money for the ${args.brandName} deal has gone out.

${amount} sent to ${args.bankName} ending ${args.accountLast4}.

Most banks show it within minutes, some take a few hours. If it has not arrived
by tomorrow, reply to this email and a person will chase it.

See your payments: ${args.walletUrl}`,
    html: shell({
      preheader: `${amount} is on its way to ${args.bankName}.`,
      body,
    }),
  };
}

/* ==========================================================================
   Deadline reminder
   ========================================================================== */

export function reminderEmail(args: {
  creatorFirstName: string;
  brandName: string;
  feeKobo: Kobo;
  deadline: string;
  daysLeft: number;
  dealUrl: string;
}): EmailContent {
  // A reminder should read as help, not as a threat. The fee is restated
  // because that is the reason to act, and the consequence is stated once,
  // plainly, rather than dressed up as urgency.
  const when =
    args.daysLeft <= 0
      ? "today"
      : args.daysLeft === 1
        ? "tomorrow"
        : `in ${args.daysLeft} days`;

  const body = `
            <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${INK};">
              Hi ${args.creatorFirstName},
            </p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${INK_2};">
              Your ${args.brandName} post is due ${when} — ${args.deadline}.
              ${formatNaira(args.feeKobo)} is waiting for you.
            </p>

            ${button(args.dealUrl, "Send your draft")}

            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${INK_2};">
              Need more time, or something has come up? Reply to this email —
              moving a deadline is usually fine if we know in advance.
            </p>`;

  return {
    subject: `Due ${when} — ${args.brandName}`,
    text: `Hi ${args.creatorFirstName},

Your ${args.brandName} post is due ${when} (${args.deadline}).
${formatNaira(args.feeKobo)} is waiting for you.

Send your draft: ${args.dealUrl}

Need more time? Reply to this email — moving a deadline is usually fine if we
know in advance.`,
    html: shell({
      preheader: `${formatNaira(args.feeKobo)} is waiting. Due ${args.deadline}.`,
      body,
    }),
  };
}

/* ==========================================================================
   The proposal — the first thing a creator ever receives
   ========================================================================== */

export interface ProposalEmailArgs {
  creatorFirstName: string;
  brandName: string;
  campaignName: string;
  deliverable: string;
  /** What the campaign is for, in the brand's own words. */
  product: string;
  /** Why this creator specifically — the model's reasoning, shown to them. */
  whyYou?: string;
  /** Indicative, not final. The creator names their own rate. */
  budgetFromKobo: Kobo;
  budgetToKobo: Kobo;
  inviteUrl: string;
  optOutNote?: string;
}

/**
 * A proposal, not a contract.
 *
 * The first email used to carry a fixed fee, a deadline and a contract link, as
 * though the creator had already agreed to terms nobody had shown them. That is
 * the wrong shape for a first approach: they have not seen the brief, have not
 * priced the work, and do not know the brand.
 *
 * So this asks one question — is this interesting? — and gives only what is
 * needed to answer it: who the brand is, what the work is, the band the budget
 * sits in, and why they were picked. Terms, deadline and contract follow once
 * they have said yes and a rate is agreed.
 *
 * The escrow line stays. It is the one fact separating this from the hundreds
 * of unpaid "collab" messages a Nigerian creator already ignores.
 */
export function proposalEmail(args: ProposalEmailArgs): EmailContent {
  const band =
    args.budgetFromKobo === args.budgetToKobo
      ? formatNaira(args.budgetToKobo)
      : `${formatNaira(args.budgetFromKobo)} to ${formatNaira(args.budgetToKobo)}`;

  const why = args.whyYou
    ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin:22px 0 0;border-left:3px solid ${BRAND};">
              <tr>
                <td style="padding:2px 0 2px 14px;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${INK};">Why you</p>
                  <p style="margin:0;font-size:14px;line-height:1.55;color:${INK_2};">${args.whyYou}</p>
                </td>
              </tr>
            </table>`
    : "";

  const body = `
            <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${INK};">
              Hi ${args.creatorFirstName},
            </p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${INK_2};">
              ${args.brandName} is running a campaign and we think you fit it. This is
              an invitation to look. Nothing is agreed yet.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${GROUND};border-radius:10px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 4px;font-size:13px;color:${INK_2};">Budget for this slot</p>
                  <p style="margin:0;font-size:28px;line-height:1.15;font-weight:700;color:${INK};letter-spacing:-0.02em;">
                    ${band}
                  </p>
                  <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${INK_2};">
                    You name your own rate when you reply. The money is already in
                    escrow, so it is not a budget that can quietly disappear.
                  </p>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
              ${row("Brand", args.brandName)}
              ${row("Campaign", args.campaignName)}
              ${row("What they want", args.deliverable)}
              ${row("About", args.product, true)}
            </table>
${why}
            ${button(args.inviteUrl, "Review this invitation")}

            <p style="margin:22px 0 0;font-size:13.5px;line-height:1.55;color:${INK_2};">
              You will see the full brief, the deadlines and the terms before you
              agree to anything. If it is not for you, decline on the same page. It
              takes one tap and we will not chase you.
            </p>`;

  // The plain-text alternative. Spam filters read it, and a creator on a cheap
  // Android mail client may see only this.
  const text = [
    `Hi ${args.creatorFirstName},`,
    ``,
    `${args.brandName} is running a campaign and we think you fit it. This is an`,
    `invitation to look — nothing is agreed yet.`,
    ``,
    `Budget for this slot: ${band}`,
    `You name your own rate when you reply. The money is already in escrow.`,
    ``,
    `Brand: ${args.brandName}`,
    `Campaign: ${args.campaignName}`,
    `What they want: ${args.deliverable}`,
    `About: ${args.product}`,
    ...(args.whyYou ? [``, `Why you: ${args.whyYou}`] : []),
    ``,
    `Review this invitation: ${args.inviteUrl}`,
    ``,
    `You will see the full brief, the deadlines and the terms before you agree to`,
    `anything. If it is not for you, decline on the same page.`,
    ``,
    `We will never ask you for a password, a bank PIN, or a code by email.`,
  ].join("\n");

  return {
    subject: `${args.brandName} wants to work with you`,
    text,
    html: shell({
      preheader: `${args.deliverable} for ${args.brandName}. Budget is already in escrow.`,
      body,
      footerNote: args.optOutNote,
    }),
  };
}

/* ==========================================================================
   The deal — sent once a rate is agreed
   ========================================================================== */

export interface DealAgreedEmailArgs {
  creatorFirstName: string;
  brandName: string;
  campaignName: string;
  deliverable: string;
  feeKobo: Kobo;
  deadline: string;
  mustInclude: string[];
  mustAvoid: string[];
  disclosureTag: string;
  usageRightsDays: number;
  dealUrl: string;
}

/**
 * The second email: the terms, now that there are terms.
 *
 * This is what the old invite email tried to be, and it belongs here — after
 * the creator has said yes and a fee is agreed. Everything in it now binds
 * them, so it is stated in full rather than summarised behind a link.
 */
export function dealAgreedEmail(args: DealAgreedEmailArgs): EmailContent {
  const fee = formatNaira(args.feeKobo);

  const list = (items: string[]) =>
    items.length
      ? items
          .map(
            (item) =>
              `<li style="margin:0 0 6px;font-size:14px;line-height:1.55;color:${INK_2};">${item}</li>`,
          )
          .join("")
      : `<li style="margin:0;font-size:14px;color:${INK_3};">Nothing specified.</li>`;

  const body = `
            <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${INK};">
              Hi ${args.creatorFirstName},
            </p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${INK_2};">
              It is agreed. ${args.brandName} has confirmed your rate, and ${fee} is
              held in escrow with your name on it.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${GROUND};border-radius:10px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 4px;font-size:13px;color:${INK_2};">You will be paid</p>
                  <p style="margin:0;font-size:34px;line-height:1.1;font-weight:700;color:${INK};letter-spacing:-0.03em;">
                    ${fee}
                  </p>
                  <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${INK_2};">
                    Released to your bank automatically once your post is live and verified.
                  </p>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
              ${row("Campaign", args.campaignName)}
              ${row("Deliverable", args.deliverable)}
              ${row("Due", args.deadline)}
              ${row("Disclosure", `${args.disclosureTag} is required by ARCON`)}
              ${row("Usage rights", `${args.usageRightsDays} days`, true)}
            </table>

            <p style="margin:24px 0 8px;font-size:14px;font-weight:600;color:${INK};">Your post must include</p>
            <ul style="margin:0;padding:0 0 0 20px;">${list(args.mustInclude)}</ul>

            <p style="margin:20px 0 8px;font-size:14px;font-weight:600;color:${INK};">It must never</p>
            <ul style="margin:0;padding:0 0 0 20px;">${list(args.mustAvoid)}</ul>

            ${button(args.dealUrl, "Sign and start")}

            <p style="margin:22px 0 0;font-size:13.5px;line-height:1.55;color:${INK_2};">
              Read the agreement before you sign. It is short, and it is what makes
              the escrow enforceable. Nothing is due from you until you have signed.
            </p>`;

  const plainList = (items: string[]) =>
    items.length ? items.map((i) => `  - ${i}`).join("\n") : "  - Nothing specified.";

  const text = [
    `Hi ${args.creatorFirstName},`,
    ``,
    `It is agreed. ${args.brandName} has confirmed your rate, and ${fee} is held in`,
    `escrow with your name on it.`,
    ``,
    `You will be paid: ${fee}`,
    `Released to your bank automatically once your post is live and verified.`,
    ``,
    `Campaign: ${args.campaignName}`,
    `Deliverable: ${args.deliverable}`,
    `Due: ${args.deadline}`,
    `Disclosure: ${args.disclosureTag} is required by ARCON`,
    `Usage rights: ${args.usageRightsDays} days`,
    ``,
    `Your post must include:`,
    plainList(args.mustInclude),
    ``,
    `It must never:`,
    plainList(args.mustAvoid),
    ``,
    `Sign and start: ${args.dealUrl}`,
    ``,
    `We will never ask you for a password, a bank PIN, or a code by email.`,
  ].join("\n");

  return {
    subject: `Agreed — ${fee} from ${args.brandName}`,
    text,
    html: shell({
      preheader: `${fee} is held for you. Here are the terms.`,
      body,
    }),
  };
}
