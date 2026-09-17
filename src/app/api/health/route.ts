import { NextResponse } from "next/server";

/**
 * Is this deployment configured correctly?
 *
 * Exists because "Application error: a server-side exception has occurred" is
 * all a Next.js production build will tell you, and the commonest cause by far
 * is a missing environment variable rather than a bug. This says which ones are
 * present without ever revealing a value.
 *
 * Deliberately reachable without signing in: the failure it diagnoses usually
 * stops anybody from signing in.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Present and non-empty. Never the value itself. */
const set = (name: string) => Boolean(process.env[name]?.trim());

export async function GET() {
  const supabaseUrl = set("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnon = set("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRole = set("SUPABASE_SERVICE_ROLE_KEY");

  const problems: string[] = [];

  // The specific trap this endpoint exists for. With a URL and anon key but no
  // service role key, the app leaves demo mode — so it stops serving fixtures —
  // but every write path and every cross-org read throws on the missing key.
  // The symptom is the whole app failing with no clue why.
  if ((supabaseUrl || supabaseAnon) && !serviceRole) {
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY is missing. With a Supabase URL set but no service role key the app leaves demo mode and then fails on every page that writes or reads across orgs.",
    );
  }
  if (supabaseUrl !== supabaseAnon) {
    problems.push(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set or both be unset.",
    );
  }
  if (!set("NEXT_PUBLIC_APP_URL")) {
    problems.push(
      "NEXT_PUBLIC_APP_URL is unset, so invite and payment links will be built against localhost.",
    );
  } else {
    // A value that is set but not a valid absolute URL is worse than an unset
    // one: `lib/env.ts` validates it and throws at module load, which takes
    // down every page that imports it while leaving middleware-only routes
    // working — a failure that looks intermittent and nothing like its cause.
    try {
      new URL(process.env.NEXT_PUBLIC_APP_URL!);
    } catch {
      problems.push(
        `NEXT_PUBLIC_APP_URL is not a valid absolute URL ("${process.env.NEXT_PUBLIC_APP_URL}"). It needs the scheme, e.g. https://subsquad.netlify.app`,
      );
    }
  }

  // Whether the parsed environment actually loads. This is the check that
  // matters: everything above can look right while one malformed value stops
  // the module that reads them from importing at all.
  let envLoads = true;
  let envError: string | null = null;
  try {
    await import("@/lib/env");
  } catch (error) {
    envLoads = false;
    envError = (error as Error).message;
    problems.push(`The environment failed to load: ${envError}`);
  }

  const demoMode =
    process.env.DEMO_MODE === "true" || !supabaseUrl || !supabaseAnon;

  // The one combination that can move real money by accident: the dry-run
  // switch off while a live Paystack secret is configured. Transfers are the
  // only call that takes money out, and this is the only place that says out
  // loud which key is loaded — a question nobody should have to answer from
  // memory before testing a payout.
  const liveKey = Boolean(process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_"));
  const dryRun = process.env.DRY_RUN !== "false";

  if (liveKey && !dryRun) {
    problems.push(
      "DRY_RUN is off and a LIVE Paystack secret key is configured. Creator withdrawals will move real money. Use a test key (sk_test_) until you mean this.",
    );
  }

  return NextResponse.json(
    {
      ok: problems.length === 0,
      mode: demoMode ? "demo (serving fixtures)" : "live",
      dryRun,
      // Never the key, only which kind it is.
      paystackMode: liveKey ? "LIVE — real money" : "test",
      configured: {
        supabaseUrl,
        supabaseAnonKey: supabaseAnon,
        supabaseServiceRoleKey: serviceRole,
        appUrl: set("NEXT_PUBLIC_APP_URL"),
        anthropic: set("ANTHROPIC_API_KEY"),
        paystack: set("PAYSTACK_SECRET_KEY"),
        resend: set("RESEND_API_KEY"),
        whatsapp: set("WHATSAPP_ACCESS_TOKEN") && set("WHATSAPP_PHONE_NUMBER_ID"),
        deepgram: set("DEEPGRAM_API_KEY"),
      },
      envLoads,
      problems,
    },
    // 503 when misconfigured, so an uptime check catches it rather than
    // reporting a healthy site that cannot serve a single page.
    { status: problems.length === 0 ? 200 : 503 },
  );
}
