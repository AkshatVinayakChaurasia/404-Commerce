import { solve } from "@/lib/engine/run";
import type { Scenario } from "@/lib/engine/types";

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
    return Response.json(await solve(body, { useClaude }));
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
