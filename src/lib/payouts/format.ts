/**
 * Phone number shaping.
 *
 * Deliberately free of server imports: the same rules have to run in the
 * browser, where the creator is typing, and on the server, where the number is
 * saved and messaged. Two implementations would drift, and the symptom would be
 * a WhatsApp message that silently never arrives.
 */

/**
 * Normalises a Nigerian number to E.164.
 *
 * People type their number every way there is — 0803…, +234803…, 234 803…,
 * with spaces, dashes and brackets. All of them are the same phone, and a
 * payout or a message sent to the wrong shape simply never lands.
 */
export function normaliseNigerianPhone(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, "");
  const bare = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  if (/^234\d{10}$/.test(bare)) return `+${bare}`;
  if (/^0\d{10}$/.test(bare)) return `+234${bare.slice(1)}`;
  if (/^\d{10}$/.test(bare)) return `+234${bare}`;
  return null;
}

/** "+2348030004471" → "0803 000 4471", which is how it is read aloud here. */
export function formatNigerianPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `0${m[1]} ${m[2]} ${m[3]}`;
}

/** "0123456789" → "•••• 6789", for showing a saved account without exposing it. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}
