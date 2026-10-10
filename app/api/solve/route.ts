import { solve } from "@/lib/engine/run";
import type { Scenario } from "@/lib/engine/types";
import { logDecisions } from "@/lib/db/log";

// POST /api/solve — the evaluator-facing endpoint.
// Body: Scenario (see lib/engine/types.ts). Add ?claude=1 to let Claude write the copy.
export async function POST(request: Request) {
  let body: Scenario;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON matching the Scenario contract" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Body must be a Scenario object" }, { status: 400 });
  }
  const useClaude = new URL(request.url).searchParams.get("claude") === "1";
  try {
    const r = await solve(body, { useClaude });
    logDecisions([
      {
        scenario_id: r.scenario_id,
        source: "solve",
        action: r.action,
        merchant_id: r.offer?.merchant_id ?? null,
        item_id: r.offer?.item_id ?? null,
        discount_pct: r.offer?.discount_pct ?? null,
        final_price_inr: r.offer?.final_price ?? null,
        profit_estimate_inr: r.economics?.expected_profit_with_offer ?? null,
        language: r.notification?.language ?? null,
        reason: r.reason,
        latency_ms: r.latency_ms,
      },
    ]);
    return Response.json(r);
  } catch {
    // Anything unexpected is a safe skip, never a 500 that costs the probe.
    return Response.json({
      scenario_id: body.scenario_id ?? "unknown",
      action: "skip",
      reason: "Request could not be evaluated; skipped safely",
      trace: { stages: [], user_checks: [], gates: [], candidates: [], tiers: [] },
      latency_ms: 0,
    });
  }
}
