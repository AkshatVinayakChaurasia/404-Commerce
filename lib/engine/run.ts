// Full /solve pipeline: deterministic decision, then copy (Claude if enabled,
// template otherwise), then the grounding gate.

import type { Scenario, SolveResult } from "./types";
import { decide } from "./solve";
import { canonLang, checkGrounding, templateCopy } from "./copy";
import { buildPrompt, claudeCopy } from "./llm";

export async function solve(s: Scenario, opts: { useClaude?: boolean } = {}): Promise<SolveResult> {
  const start = performance.now();
  const { facts, ...decision } = decide(s);
  const result: SolveResult = { ...decision, latency_ms: 0 };

  if (decision.action === "send" && facts) {
    const t0 = performance.now();
    let source: "claude" | "template" = "template";
    let fallback_reason: string | undefined;
    let copy = templateCopy(facts);
    if (opts.useClaude) {
      const r = await claudeCopy(facts);
      result.trace.prompt = r.prompt;
      if (r.copy) {
        copy = { ...r.copy, cta: copy.cta };
        source = "claude";
      } else {
        fallback_reason = r.problem;
      }
    } else {
      result.trace.prompt = buildPrompt(facts);
    }
    const g = checkGrounding(copy, facts);
    result.notification = {
      ...copy,
      language: canonLang(facts.language),
      source,
      grounded: g.ok,
      fallback_reason,
    };
    result.trace.stages.push({
      id: "copy",
      label: "Write the message",
      summary:
        source === "claude"
          ? "Claude wrote it; every number matches the engine"
          : fallback_reason
            ? `Template used (${fallback_reason})`
            : "Template copy; every number matches the engine",
      ms: performance.now() - t0,
    });
  }

  result.latency_ms = Math.round((performance.now() - start) * 10) / 10;
  return result;
}
