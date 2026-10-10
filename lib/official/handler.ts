// Shared HTTP handler for POST /decide (the path the organizers call) and /api/decide.
// Body: one scenario row (blind holdout shape), an array of rows, or { id } for a
// known scenario. ?trace=1 adds the engine trace; ?llm=1 lets the model write copy.

import { decideOfficial, type OfficialResponse } from "./adapter";
import { logDecisions } from "../db/log";

const MAX_BATCH = 200;

export async function handleDecide(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const withTrace = url.searchParams.get("trace") === "1";
  const useClaude = url.searchParams.get("llm") === "1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON: a scenario object, an array of them, or { \"id\": \"cur_001\" }" }, { status: 400 });
  }

  const logged: ReturnType<typeof toLog>[] = [];
  const one = async (row: unknown) => {
    if (!row || typeof row !== "object") return { scenario_id: "unknown", action: "skip", reason: "Scenario must be an object; skipped." };
    try {
      const r = await decideOfficial(row as Record<string, unknown>, { useClaude, evaluator: true });
      logged.push(toLog(r.response, r.solve?.latency_ms ?? null));
      return withTrace ? { ...r.response, engine: r.solve ?? null, context_overrides: r.overrides } : r.response;
    } catch {
      const id = (row as Record<string, unknown>).id ?? (row as Record<string, unknown>).scenario_id ?? "unknown";
      return { scenario_id: String(id), action: "skip", reason: "Scenario could not be evaluated; skipped safely." };
    }
  };

  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) return Response.json({ error: `At most ${MAX_BATCH} scenarios per call` }, { status: 413 });
    const out = await Promise.all(body.map(one));
    logDecisions(logged);
    return Response.json(out);
  }
  const out = await one(body);
  logDecisions(logged);
  return Response.json(out);
}

function toLog(r: OfficialResponse, latency: number | null) {
  return {
    scenario_id: r.scenario_id,
    source: "decide" as const,
    action: r.action,
    merchant_id: r.offer?.merchant_id ?? null,
    item_id: r.offer?.item_id ?? null,
    discount_pct: r.offer?.discount_pct ?? null,
    final_price_inr: r.offer?.final_price_inr ?? null,
    profit_estimate_inr: r.profit_estimate_inr,
    language: r.notification?.language ?? null,
    reason: r.reason,
    latency_ms: latency,
  };
}

export function decideUsage(): Response {
  return Response.json({
    endpoint: "POST /decide",
    body: "A scenario row from scenarios_public.csv or scenarios_holdout_blind.csv (as JSON), an array of rows, or { \"id\": \"cur_001\" }",
    query: { trace: "1 adds the full engine run (trace, offer detail, economics)", llm: "1 lets the language model write the copy (falls back to templates)" },
    example: { id: "cur_001" },
  });
}
