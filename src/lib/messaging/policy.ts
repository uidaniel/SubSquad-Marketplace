/**
 * When the platform is allowed to message a creator.
 *
 * Pure, and separate from the transport on purpose: these are the promises the
 * product makes to creators, and promises should be testable without a network,
 * a database, or a Next.js runtime.
 */

export type Channel = "whatsapp" | "email" | "manual";

export type SendRefusal =
  | "opted_out"
  | "rate_limited"
  | "not_approved"
  | "no_channel"
  | "provider_error";

export interface CreatorContactState {
  doNotContact: boolean;
  lastUnsolicitedAt: string | null;
  phone: string | null;
  email: string | null;
  whatsappOptIn: boolean;
}

export const UNSOLICITED_COOLDOWN_DAYS = 7;

/** Which channels this deployment can actually send on. */
export interface AvailableChannels {
  whatsapp: boolean;
  email: boolean;
}

/**
 * Which channel to use for a first approach.
 *
 * WhatsApp first is the whole product thesis: it is where Nigerian creators
 * actually reply. Email is the fallback, and when there is neither the deal is
 * handed to a person rather than quietly dropped.
 *
 * `available` exists because a channel that is not configured is not a channel.
 * Routing a creator to WhatsApp because we hold their phone number, when no
 * WhatsApp account is connected, produces a provider error per creator and an
 * outreach run that silently reaches nobody. Preferring a channel we can
 * actually send on is not a compromise — an email that arrives beats a
 * WhatsApp message that does not.
 */
export function chooseChannel(
  contact: CreatorContactState,
  available: AvailableChannels = { whatsapp: true, email: true },
): Channel | null {
  const canWhatsApp = available.whatsapp && Boolean(contact.phone);
  const canEmail = available.email && Boolean(contact.email);

  if (canWhatsApp && contact.whatsappOptIn) return "whatsapp";
  if (canEmail) return "email";
  if (canWhatsApp) return "whatsapp";
  // We hold a way to reach them but cannot use it. That is a configuration
  // problem for ops to see, not a creator to drop.
  if (contact.phone || contact.email) return "manual";
  return null;
}

export function checkSendAllowed(
  contact: CreatorContactState,
  request: { isReply?: boolean; aiDraft?: boolean; approvedBy?: string | null },
  now = new Date(),
): { allowed: true } | { allowed: false; reason: SendRefusal; detail: string } {
  // Checked first: an opt-out outranks every other consideration, including an
  // approved draft and an active conversation.
  if (contact.doNotContact) {
    return {
      allowed: false,
      reason: "opted_out",
      detail: "This creator has opted out of being contacted.",
    };
  }

  if (request.aiDraft && !request.approvedBy) {
    return {
      allowed: false,
      reason: "not_approved",
      detail: "This message was drafted by AI and has not been approved by a person.",
    };
  }

  if (!request.isReply && contact.lastUnsolicitedAt) {
    const since = now.getTime() - new Date(contact.lastUnsolicitedAt).getTime();
    const cooldownMs = UNSOLICITED_COOLDOWN_DAYS * 86_400_000;
    if (since < cooldownMs) {
      const days = Math.ceil((cooldownMs - since) / 86_400_000);
      return {
        allowed: false,
        reason: "rate_limited",
        detail: `Contacted ${Math.floor(since / 86_400_000)} days ago. Next unsolicited message allowed in ${days} day${days === 1 ? "" : "s"}.`,
      };
    }
  }

  return { allowed: true };
}
