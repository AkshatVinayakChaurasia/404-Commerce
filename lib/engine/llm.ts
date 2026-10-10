// Optional: Claude writes the notification copy from the engine's facts.
// Server-only (reads ANTHROPIC_API_KEY). Any failure, timeout, refusal or
// ungrounded number falls back to the template, so /solve always answers.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { CopyFacts } from "./solve";
import { checkGrounding, type Copy } from "./copy";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
/** Leaves ~2 s of the 8 s budget for the engine, network and the fallback. */
const LLM_TIMEOUT_MS = 5000;

const CopySchema = z.object({
  title: z.string(),
  body: z.string(),
});

export const llmAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

export function buildPrompt(f: CopyFacts): string {
  const lang =
    f.language === "hinglish"
      ? "Hinglish (Hindi words in Latin script mixed with English, the way people in Bangalore text each other)"
      : "plain English";
  return [
    `Write one push notification in ${lang} for ${f.user_name}.`,
    "Use only these facts. Do not add any other number, price, distance, time, item or claim.",
    `- Merchant: ${f.merchant_name}`,
    `- Item: ${f.item_name}`,
    `- Price now: ₹${f.final_price} (was ₹${f.base_price}, ${f.discount_pct}% off)`,
    `- Walk: ${f.walk_minutes} min`,
    `- Valid until: ${f.valid_until_clock}`,
    `- Weather: ${f.weather}, ${f.temp_c}°C; time of day: ${f.daypart}`,
    "Title: at most 40 characters. Body: at most 140 characters, must name the merchant and the price now.",
    "Warm and specific, no exclamation marks, no emoji, no hashtags.",
  ].join("\n");
}

export async function claudeCopy(
  f: CopyFacts,
): Promise<{ copy: Copy | null; problem?: string; prompt: string }> {
  const prompt = buildPrompt(f);
  if (!llmAvailable()) return { copy: null, problem: "no API key configured", prompt };
  try {
    const client = new Anthropic({ timeout: LLM_TIMEOUT_MS, maxRetries: 0 });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(CopySchema) },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return { copy: null, problem: "model declined", prompt };
    const copy = response.parsed_output;
    if (!copy) return { copy: null, problem: "output did not match schema", prompt };
    const g = checkGrounding(copy, f);
    if (!g.ok) return { copy: null, problem: g.problem, prompt };
    return { copy, prompt };
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return { copy: null, problem: `timed out after ${LLM_TIMEOUT_MS / 1000}s`, prompt };
    }
    if (err instanceof Anthropic.RateLimitError) return { copy: null, problem: "rate limited", prompt };
    if (err instanceof Anthropic.APIError) {
      return { copy: null, problem: `API error ${err.status ?? ""}`.trim(), prompt };
    }
    return { copy: null, problem: "model call failed", prompt };
  }
}
