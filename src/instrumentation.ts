/**
 * Server error capture.
 *
 * Netlify's log viewer truncates the error message, which is how two plausible
 * theories about a 502 both turned out to be wrong. This writes the whole thing
 * — message, stack, route — somewhere it can be read back.
 *
 * Sentry does this properly and is in the spec; this is what stands in until a
 * DSN exists, and it costs one insert on a path that is already failing.
 */

export async function register() {
  // Node only. The edge runtime has no process events and no service client.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // An unhandled rejection is what Netlify reports as "This function has
  // crashed", with no indication of which promise or where.
  process.on("unhandledRejection", (reason) => {
    void recordError("unhandledRejection", reason);
  });

  process.on("uncaughtException", (error) => {
    void recordError("uncaughtException", error);
  });
}

/**
 * Next calls this for every error thrown while rendering a request, with the
 * route attached — which is the part the platform log leaves out.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string },
) {
  await recordError("request", error, request.path);
}

async function recordError(
  kind: string,
  error: unknown,
  path?: string,
): Promise<void> {
  const err = error as Error & { digest?: string };
  const message = err?.message ?? String(error);

  // Always to stdout, so it is in the platform log even if the insert fails.
  console.error(`[${kind}]${path ? ` ${path}` : ""} ${message}\n${err?.stack ?? ""}`);

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    // Written over the REST endpoint rather than through the SDK: this runs
    // during a crash, and importing a client is one more thing to fail.
    await fetch(`${url}/rest/v1/server_errors`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        kind,
        path: path ?? null,
        message: message.slice(0, 2000),
        stack: (err?.stack ?? "").slice(0, 8000),
        digest: err?.digest ?? null,
      }),
    });
  } catch {
    // Reporting an error must never be the thing that raises one.
  }
}
