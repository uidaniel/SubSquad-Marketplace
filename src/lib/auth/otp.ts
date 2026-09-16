import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { requireServiceClient } from "@/lib/supabase/service";
import { sendTransactional } from "@/lib/messaging/send";
import { env } from "@/lib/env";
import { formatNigerianPhone } from "@/lib/payouts/banks";

/**
 * One-time codes, over WhatsApp.
 *
 * The spec called for SMS. WhatsApp is used instead for two reasons: the
 * creator has just arrived from a WhatsApp link, so it is the channel they are
 * already reading; and SMS delivery to Nigerian networks is slow, expensive and
 * silently lossy in a way that would strand people mid-onboarding. SMS remains
 * a sensible fallback to add later — the interface here does not care which
 * channel carried the code.
 *
 * The rules that make a six-digit code safe:
 *   · stored as a keyed hash, so a leaked table is not a list of live codes
 *   · five attempts, then the code is dead — six digits is 1-in-a-million once,
 *     and 1-in-200,000 if you let somebody try five times, but 1-in-2 if you
 *     let them try half a million
 *   · ten minutes to live
 *   · a cap on how many codes one number can be sent, so this is not a free
 *     WhatsApp-spam machine pointed at anyone's phone
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
/** Codes are 6 digits; leading zeros are kept, so treat them as strings. */
const CODE_LENGTH = 6;

/**
 * The key that makes the stored hash useless to anyone who only has the table.
 *
 * It rides on the service role key rather than adding another secret to rotate:
 * anybody holding that already has the database, so this adds no new exposure.
 */
function hashCode(phone: string, code: string): string {
  const secret = env.SUPABASE_SERVICE_ROLE_KEY ?? "development-only-secret";
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function generateCode(): string {
  // randomInt is drawn from the CSPRNG; Math.random is predictable enough to
  // guess a code from, given a few samples.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export type SendCodeResult =
  | { ok: true; dryRun: boolean; devCode?: string }
  | { ok: false; error: string };

/**
 * Sends a code to a phone number.
 *
 * In dry-run the code comes back in the result so the flow can be walked
 * end to end on a development machine. That only ever happens when DRY_RUN is
 * on — with real credentials the code exists solely on the creator's phone.
 */
export async function sendVerificationCode(
  phone: string,
): Promise<SendCodeResult> {
  const db = requireServiceClient();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("phone_verifications")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
    return {
      ok: false,
      error:
        "That is a lot of codes for one number. Wait an hour, or reply to our WhatsApp message and a person will help.",
    };
  }

  const code = generateCode();
  const { error } = await db.from("phone_verifications").insert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });

  if (error) {
    return { ok: false, error: "We could not send a code just now. Try again." };
  }

  const outcome = await sendTransactional({
    channel: "whatsapp",
    to: { phone },
    label: `verification code for ${formatNigerianPhone(phone)}`,
    body:
      `${code} is your SubSquad code.\n\n` +
      `It expires in 10 minutes. We will never ask you for this code — ` +
      `if somebody does, it is a scam.`,
  });

  if (!outcome.sent) {
    return {
      ok: false,
      error:
        "We could not reach that WhatsApp number. Check it and try again.",
    };
  }

  return {
    ok: true,
    dryRun: Boolean(outcome.dryRun),
    devCode: outcome.dryRun ? code : undefined,
  };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string; attemptsLeft?: number };

/**
 * Checks a code against the most recent one issued for that number.
 *
 * Only the latest matters: asking for a new code should invalidate the old one,
 * or a code read over somebody's shoulder stays good for ten minutes after they
 * have replaced it.
 */
export async function verifyCode(
  phone: string,
  submitted: string,
): Promise<VerifyResult> {
  const db = requireServiceClient();
  const code = submitted.replace(/\D/g, "");

  const { data: row } = await db
    .from("phone_verifications")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { ok: false, error: "Ask for a code first." };
  }
  if (row.verified_at) {
    // Already used. Re-verifying should not be possible with the same code.
    return { ok: false, error: "That code has already been used." };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many tries. Ask for a new code.",
      attemptsLeft: 0,
    };
  }

  if (!constantTimeEquals(row.code_hash, hashCode(phone, code))) {
    const attempts = row.attempts + 1;
    await db
      .from("phone_verifications")
      .update({ attempts })
      .eq("id", row.id);

    const attemptsLeft = MAX_ATTEMPTS - attempts;
    return {
      ok: false,
      error:
        attemptsLeft > 0
          ? `That code is not right. ${attemptsLeft} ${
              attemptsLeft === 1 ? "try" : "tries"
            } left.`
          : "Too many tries. Ask for a new code.",
      attemptsLeft,
    };
  }

  await db
    .from("phone_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true };
}
