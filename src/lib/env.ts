import { z } from "zod";

/**
 * Environment access, parsed once.
 *
 * Every external integration is optional at build time so the app runs with an
 * empty `.env` — in that state it starts in demo mode with mock providers, which
 * is how the product is developed and demoed before an account exists for each
 * vendor. `DRY_RUN` is the separate, louder switch: providers may be fully
 * configured but must still only log instead of sending or moving money.
 */

/**
 * A value that may simply not be set.
 *
 * `.env.example` ships every key with an empty value so the file documents what
 * exists. An empty string therefore has to mean "not configured" rather than
 * "configured as nothing", or every unused integration fails validation at boot.
 */
const blankIsUnset = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optional = () => z.preprocess(blankIsUnset, z.string().min(1).optional());

const optionalUrl = () =>
  z.preprocess(blankIsUnset, z.string().url().optional());

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Nothing is sent to a creator or charged to a card while this is true. */
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v !== "false"),

  /** Serve seeded fixtures instead of Postgres. Implied when Supabase is unset. */
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  NEXT_PUBLIC_SUPABASE_URL: optionalUrl(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(),
  SUPABASE_SERVICE_ROLE_KEY: optional(),

  ANTHROPIC_API_KEY: optional(),

  PAYSTACK_SECRET_KEY: optional(),
  PAYSTACK_PUBLIC_KEY: optional(),

  WHATSAPP_PHONE_NUMBER_ID: optional(),
  WHATSAPP_ACCESS_TOKEN: optional(),
  WHATSAPP_VERIFY_TOKEN: optional(),

  RESEND_API_KEY: optional(),
  RESEND_FROM: optional(),

  DEEPGRAM_API_KEY: optional(),

  SENTRY_DSN: optional(),
  NEXT_PUBLIC_POSTHOG_KEY: optional(),
  LANGFUSE_PUBLIC_KEY: optional(),
  LANGFUSE_SECRET_KEY: optional(),

  /** Absolute origin, used to build invite and approval links. */
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // A malformed value is a bug worth failing loudly for; a missing optional one
  // is not, and never reaches here.
  console.error(
    "Invalid environment:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment — see the errors above.");
}

const raw = parsed.data;

const hasSupabase = Boolean(
  raw.NEXT_PUBLIC_SUPABASE_URL && raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const env = {
  ...raw,
  /** True when the app should read seeded fixtures rather than Postgres. */
  demoMode: raw.DEMO_MODE || !hasSupabase,
  hasSupabase,
  isProd: raw.NODE_ENV === "production",
} as const;

/** Vendors that are wired up right now. Surfaced on the ops health screen. */
export const integrations = {
  supabase: hasSupabase,
  anthropic: Boolean(raw.ANTHROPIC_API_KEY),
  paystack: Boolean(raw.PAYSTACK_SECRET_KEY),
  whatsapp: Boolean(raw.WHATSAPP_ACCESS_TOKEN && raw.WHATSAPP_PHONE_NUMBER_ID),
  resend: Boolean(raw.RESEND_API_KEY),
  deepgram: Boolean(raw.DEEPGRAM_API_KEY),
  sentry: Boolean(raw.SENTRY_DSN),
  posthog: Boolean(raw.NEXT_PUBLIC_POSTHOG_KEY),
  langfuse: Boolean(raw.LANGFUSE_SECRET_KEY),
} as const;

export type IntegrationName = keyof typeof integrations;
