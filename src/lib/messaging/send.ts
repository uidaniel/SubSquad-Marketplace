import "server-only";

import { env, integrations } from "@/lib/env";

/**
 * Outbound messaging.
 *
 * Everything the platform sends a creator goes through `sendMessage`. Not most
 * things — everything, including retries and background jobs, because the
 * promises this product makes to creators are only as good as the narrowest
 * path that can reach them:
 *
 *  - a creator who opted out is never messaged again;
 *  - a creator who has not replied is contacted at most once a week;
 *  - nothing an AI wrote goes out until a named person approved it;
 *  - in DRY_RUN, nothing goes out at all, and the attempt is logged instead.
 *
 * The provider clients below are deliberately thin. They know how to put a
 * message on a wire and nothing about when they are allowed to.
 */

export {
  chooseChannel,
  checkSendAllowed,
  UNSOLICITED_COOLDOWN_DAYS,
} from "./policy";
export type { Channel, CreatorContactState, SendRefusal } from "./policy";

import {
  checkSendAllowed as checkAllowed,
  type Channel,
  type CreatorContactState,
  type SendRefusal,
} from "./policy";

export interface SendRequest {
  dealId: string;
  channel: Channel;
  body: string;
  /** Present for email. */
  subject?: string;
  to: { phone?: string | null; email?: string | null };
  /** The plain-text alternative when `body` is HTML from a template. */
  text?: string;
  /** Set on a reply inside a live conversation, which is not rate-limited. */
  isReply?: boolean;
  /** The user id that approved this. Required for anything an AI drafted. */
  approvedBy?: string | null;
  aiDraft?: boolean;
}

export type SendOutcome =
  | { sent: true; providerMessageId: string; dryRun: boolean }
  | { sent: false; reason: SendRefusal; detail: string };

export async function sendMessage(
  request: SendRequest,
  contact: CreatorContactState,
): Promise<SendOutcome> {
  const allowed = checkAllowed(contact, request);
  if (!allowed.allowed) {
    return { sent: false, reason: allowed.reason, detail: allowed.detail };
  }

  if (request.channel === "manual") {
    return {
      sent: false,
      reason: "no_channel",
      detail: "Marked for a person to send by hand.",
    };
  }

  // The switch that stands between a development machine and a real creator's
  // phone. On by default; turning it off is a deliberate act.
  if (env.DRY_RUN) {
    console.info(
      `[dry-run] would send ${request.channel} for deal ${request.dealId}:\n${request.body}\n`,
    );
    return {
      sent: true,
      providerMessageId: `dryrun_${Date.now().toString(36)}`,
      dryRun: true,
    };
  }

  try {
    const providerMessageId =
      request.channel === "whatsapp"
        ? await sendWhatsApp(request.to.phone!, request.body)
        : await sendEmail(
            request.to.email!,
            request.subject ?? "A funded brand deal for you",
            request.body,
            request.text,
          );
    return { sent: true, providerMessageId, dryRun: false };
  } catch (error) {
    return {
      sent: false,
      reason: "provider_error",
      detail: (error as Error).message,
    };
  }
}

/**
 * A message the recipient just asked for — a one-time code, a receipt.
 *
 * This deliberately skips the outreach policy. That policy exists to stop the
 * platform pestering creators who never asked to hear from it; applying it to a
 * code somebody requested two seconds ago would mean a creator who was invited
 * this week could not sign in. DRY_RUN still applies — the switch between a
 * development machine and a real phone is never bypassed.
 */
export async function sendTransactional(request: {
  channel: "whatsapp" | "email";
  to: { phone?: string | null; email?: string | null };
  body: string;
  subject?: string;
  /** The plain-text alternative, when the body is HTML from a template. */
  text?: string;
  /** Names the message in the dry-run log, so it is obvious what would go out. */
  label: string;
}): Promise<SendOutcome> {
  if (request.channel === "whatsapp" && !request.to.phone) {
    return { sent: false, reason: "no_channel", detail: "No phone number." };
  }
  if (request.channel === "email" && !request.to.email) {
    return { sent: false, reason: "no_channel", detail: "No email address." };
  }

  if (env.DRY_RUN) {
    console.info(
      `[dry-run] would send ${request.channel} (${request.label}):\n${request.body}\n`,
    );
    return {
      sent: true,
      providerMessageId: `dryrun_${Date.now().toString(36)}`,
      dryRun: true,
    };
  }

  try {
    const providerMessageId =
      request.channel === "whatsapp"
        ? await sendWhatsApp(request.to.phone!, request.body)
        : await sendEmail(
            request.to.email!,
            request.subject ?? "SubSquad",
            request.body,
            request.text,
          );
    return { sent: true, providerMessageId, dryRun: false };
  } catch (error) {
    return {
      sent: false,
      reason: "provider_error",
      detail: (error as Error).message,
    };
  }
}

/* ==========================================================================
   Providers
   ========================================================================== */

async function sendWhatsApp(to: string, body: string): Promise<string> {
  if (!integrations.whatsapp) {
    throw new Error("WhatsApp is not configured");
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d]/g, ""),
        type: "text",
        text: { preview_url: true, body },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp refused the message (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as { messages?: { id: string }[] };
  return json.messages?.[0]?.id ?? "unknown";
}

/**
 * Sends an email.
 *
 * `body` may be either HTML from a template or plain text written for WhatsApp,
 * because the same call site serves both channels. Rather than make every
 * caller say which, this looks: a body that opens with a doctype is HTML.
 *
 * Both parts are always sent. A text alternative is not politeness — a mail
 * client that shows only the HTML part is fine, but spam filters read the text
 * part, and an HTML-only message from a young domain scores worse for it.
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string,
  text?: string,
): Promise<string> {
  if (!integrations.resend) {
    throw new Error("Resend is not configured");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  const isHtml = body.trimStart().toLowerCase().startsWith("<!doctype");

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM ?? "SubSquad <hello@subsquad.ng>",
    to,
    subject,
    ...(isHtml
      ? { html: body, text: text ?? stripHtml(body) }
      : { text: body }),
  });

  if (error) throw new Error(error.message);
  return data?.id ?? "unknown";
}

/**
 * A readable plain-text version when a caller did not supply one.
 *
 * Crude on purpose: it exists so the text part is never empty, and every
 * template ships a hand-written `text` that is used in preference to this.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
