// TypeScript port of the organizers' eval/evaluator.py (same checks, same weights).
// Used by `npm run predict` and by the landing page's live dataset numbers.

import { dataset, decideOfficial, type OfficialResponse } from "./adapter";

const merchants = new Map(dataset.merchants.map((m) => [m.id, m]));
const customers = new Map(dataset.customers.map((c) => [c.id, c]));

export type Score = {
  decision_match: number;
  groundedness: number;
  constraint: number;
  localization: number;
  has_profit: number;
  overall: number;
  matched: number;
  n: number;
};

export function evaluate(rows: { id: string; customer_id: string; expected_action?: string }[], preds: Map<string, OfficialResponse>): Score {
  const acc = { decision: 0, grounded: 0, constraint: 0, loc: 0, profit: 0, matched: 0 };
  for (const sc of rows) {
    const p = preds.get(sc.id);
    if (!p) continue;
    const hit = p.action === sc.expected_action;
    acc.matched += hit ? 1 : 0;
    acc.decision += hit ? 1 : 0.5;
    let grounded = 1;
    let constraint = 1;
    let loc = 0.5;
    let profit = 0;
    if (p.action === "send") {
      const m = p.offer ? merchants.get(p.offer.merchant_id) : undefined;
      if (!m) grounded = 0;
      else {
        const disc = p.offer!.discount_pct;
        if (disc > m.max_discount_pct + 0.5) constraint = 0;
        const price = m.base_price_inr ?? 200;
        const cost = m.unit_cost_inr ?? 80;
        if (disc > 0 && price * (1 - disc / 100) < cost * (1 + m.min_margin_pct / 100)) constraint = Math.min(constraint, 0.6);
        const text = `${p.notification?.body ?? ""}${p.notification?.title ?? ""}`.toLowerCase();
        if (!text.includes(m.name.toLowerCase()) && !text.includes(m.name.split(" ")[0].toLowerCase())) grounded = Math.min(grounded, 0.7);
      }
      const c = customers.get(sc.customer_id);
      if (c && !c.marketing_consent) constraint = 0;
      const lang = (p.notification?.language ?? "").toLowerCase();
      if (c && lang) loc = lang === c.language || lang.split("-")[0] === c.language.split("-")[0] ? 1 : 0.6;
      if (p.profit_estimate_inr !== null && p.profit_estimate_inr !== undefined) profit = 1;
    }
    if (p.action === "skip" && p.offer) grounded = Math.min(grounded, 0.5);
    acc.grounded += grounded;
    acc.constraint += constraint;
    acc.loc += loc;
    acc.profit += profit;
  }
  const n = rows.length;
  const s = {
    decision_match: acc.decision / n,
    groundedness: acc.grounded / n,
    constraint: acc.constraint / n,
    localization: acc.loc / n,
    has_profit: acc.profit / n,
  };
  return { ...s, overall: 0.3 * s.decision_match + 0.25 * s.groundedness + 0.25 * s.constraint + 0.1 * s.localization + 0.1 * s.has_profit, matched: acc.matched, n };
}

export async function predictAll(rows: { id: string }[]) {
  const preds = new Map<string, OfficialResponse>();
  for (const row of rows) preds.set(row.id, (await decideOfficial({ id: row.id }, { evaluator: true })).response);
  return preds;
}

export async function scorePublic() {
  const rows = dataset.scenarios_public as { id: string; customer_id: string; expected_action?: string }[];
  const preds = await predictAll(rows);
  return { score: evaluate(rows, preds), preds };
}
