import { dataset } from "@/lib/official/adapter";

// Scenario list for the Decision Lab's dataset mode. Labels are shown only for
// the public set; the blind holdout has none.
export async function GET() {
  const merchants = new Map(dataset.merchants.map((m) => [m.id, m]));
  const customers = new Map(dataset.customers.map((c) => [c.id, c]));
  const rows = [...dataset.scenarios_public, ...dataset.scenarios_holdout_blind].map((s) => ({
    id: s.id,
    split: s.split,
    title: s.title,
    type: s.scenario_type,
    timestamp: s.timestamp,
    prompt: s.prompt,
    customer: { id: s.customer_id, name: customers.get(s.customer_id)?.name ?? s.customer_id, language: customers.get(s.customer_id)?.language ?? "" },
    merchant: { id: s.merchant_id, name: merchants.get(s.merchant_id)?.name ?? s.merchant_id, category: merchants.get(s.merchant_id)?.category ?? "" },
    minutes_available: s.minutes_available,
    expected_action: "expected_action" in s ? (s as { expected_action?: string }).expected_action : undefined,
  }));
  return Response.json({ version: dataset.version, scenarios: rows });
}
