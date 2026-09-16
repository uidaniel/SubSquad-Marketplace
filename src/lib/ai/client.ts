import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { AI_CONFIG, type AiPurpose } from "./models";
import { env } from "@/lib/env";

/**
 * The one way this product talks to a model.
 *
 * Three things happen on every call and none of them are optional:
 *
 *  1. The output is parsed against a Zod schema. A model is not trusted to have
 *     returned the right shape, and a malformed response is retried once with
 *     the parse error fed back before the call is given up on.
 *  2. The call is recorded — prompt, raw output, model, tokens, latency — so a
 *     shortlist decision or a content rejection can be explained months later.
 *     The product promises creators an appeal; this is what makes that possible.
 *  3. Without an API key it returns a stub instead of failing. The app is meant
 *     to run end to end with an empty .env.
 */

export interface AiCallContext {
  purpose: AiPurpose;
  campaignId?: string | null;
  dealId?: string | null;
  creatorId?: string | null;
  promptVersion: string;
}

export interface AiResult<T> {
  data: T;
  /** False when this came from the stub rather than a model. */
  live: boolean;
  callId: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export class AiParseError extends Error {
  constructor(
    message: string,
    readonly rawOutput: string,
  ) {
    super(message);
    this.name = "AiParseError";
  }
}

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/** Pulls the first JSON object out of a response that may be wrapped in prose. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new AiParseError("no JSON object found in the response", text);
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new AiParseError(
      `response was not valid JSON: ${(error as Error).message}`,
      text,
    );
  }
}

/**
 * Calls the model and returns validated output.
 *
 * `stub` is what the call returns when no API key is configured. It is required
 * rather than optional so that adding a new AI feature forces a decision about
 * what the product does without AI — which, for a product where every AI action
 * is reviewed by a person anyway, is always "something reasonable".
 */
export async function callModel<S extends z.ZodTypeAny>(
  context: AiCallContext,
  args: {
    system: string;
    user: string;
    schema: S;
    stub: z.infer<S>;
  },
): Promise<AiResult<z.infer<S>>> {
  const started = Date.now();
  const config = AI_CONFIG[context.purpose];
  const api = anthropic();

  if (!api) {
    return {
      data: args.stub,
      live: false,
      callId: null,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - started,
    };
  }

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: args.user }];
  let lastError: AiParseError | null = null;

  // One retry, with the parse error handed back. A second failure is a prompt
  // bug, not a flake, and looping would only burn tokens hiding it.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await api.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: args.system,
      messages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    try {
      const parsed = args.schema.parse(extractJson(text));
      const result: AiResult<z.infer<S>> = {
        data: parsed,
        live: true,
        callId: null,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        latencyMs: Date.now() - started,
      };
      await recordCall(context, config.model, args, text, result, null);
      return result;
    } catch (error) {
      lastError =
        error instanceof AiParseError
          ? error
          : new AiParseError((error as Error).message, text);

      if (attempt === 1) {
        messages.push(
          { role: "assistant", content: text },
          {
            role: "user",
            content: `That response could not be used: ${lastError.message}\n\nReturn only the JSON object, matching the schema exactly, with no commentary around it.`,
          },
        );
      }
    }
  }

  await recordCall(
    context,
    config.model,
    args,
    lastError?.rawOutput ?? "",
    null,
    lastError?.message ?? "unknown parse failure",
  );
  throw lastError ?? new Error("model call failed");
}

/**
 * Writes the audit row.
 *
 * Deliberately swallows its own errors: losing an audit row is bad, but failing
 * a creator's content review because the audit insert timed out is worse. The
 * failure is logged for Sentry to pick up.
 */
async function recordCall(
  context: AiCallContext,
  model: string,
  args: { system: string; user: string },
  rawOutput: string,
  result: AiResult<unknown> | null,
  parseError: string | null,
): Promise<void> {
  try {
    const { getServiceClient } = await import("@/lib/supabase/service");
    const db = getServiceClient();
    if (!db) return;

    await db.from("ai_calls").insert({
      purpose: context.purpose,
      campaign_id: context.campaignId ?? null,
      deal_id: context.dealId ?? null,
      creator_id: context.creatorId ?? null,
      model,
      prompt_version: context.promptVersion,
      prompt: { system: args.system, user: args.user },
      output: rawOutput ? { raw: rawOutput } : null,
      parse_error: parseError,
      tokens_in: result?.tokensIn ?? null,
      tokens_out: result?.tokensOut ?? null,
      latency_ms: result?.latencyMs ?? null,
    });
  } catch (error) {
    console.error("[ai] could not record call:", (error as Error).message);
  }
}
