// Guardrail check over synthetic requests (blueprint: "Hard-Constraint Violation
// Rate, target zero"). Run: npm test
// Re-derives every rule independently of solve.ts so a bug there can't hide itself.

import { MERCHANTS, OFFICE, offset, presetById } from "../lib/data/koramangala";
import { decide } from "../lib/engine/solve";
import { checkGrounding, templateCopy } from "../lib/engine/copy";
import { haversineM, hhmmToMin, inWindow, mulberry32, parseLocal } from "../lib/engine/util";
import type { Scenario } from "../lib/engine/types";

const N = 1000;
const r = mulberry32(42);
const failures: string[] = [];
let sends = 0;

const fail = (i: number, msg: string) => failures.length < 20 && failures.push(`#${i}: ${msg}`);

for (let i = 0; i < N; i++) {
  const merchants = structuredClone(MERCHANTS);
  // Shake the catalog so edge cases show up: zero max discounts, empty stock, missing margins.
  for (const m of merchants) {
    if (r() < 0.15) m.max_discount_pct = 0;
    if (r() < 0.1) m.items.forEach((it) => (it.stock = 0));
    if (r() < 0.1) m.items.forEach((it) => delete it.margin_pct);
  }
  const day = 12 + Math.floor(r() * 7);
  const min = Math.floor(r() * 1440);
  const s: Scenario = {
    scenario_id: `check-${i}`,
    now: `2026-10-${day}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00+05:30`,
    user: {
      id: `u${i}`,
      name: "Test",
      location: offset(OFFICE, (r() - 0.5) * 3000, (r() - 0.5) * 3000),
      wallet_inr: Math.round(30 + r() * 600),
      marketing_consent: r() < 0.8 ? true : r() < 0.5 ? false : undefined,
      free_until: r() < 0.5 ? `${String(Math.floor(((min + 10 + r() * 60) % 1440) / 60)).padStart(2, "0")}:00` : undefined,
      category_affinity: { coffee: r(), healthy: r(), south_indian: r(), dessert: r(), chinese: r(), cafe: r() },
      visits: r() < 0.3 ? { [merchants[Math.floor(r() * merchants.length)].id]: Math.floor(r() * 6) } : {},
      price_sensitivity: r(),
      diet: r() < 0.5 ? ["veg"] : [],
    },
    context: { weather: { condition: ["clear", "rain", "heavy_rain", "cloudy"][Math.floor(r() * 4)], temp_c: 18 + Math.floor(r() * 22) } },
    merchants,
  };

  const d = decide(s);
  if (d.action !== "send") continue;
  sends++;
  const o = d.offer!;
  const m = merchants.find((x) => x.id === o.merchant_id)!;
  const item = m.items.find((x) => x.id === o.item_id)!;
  const local = parseLocal(s.now)!;

  if (s.user.marketing_consent !== true) fail(i, "sent without consent");
  if (m.hours.days && !m.hours.days.includes(local.day)) fail(i, `${m.name} closed today`);
  if (!inWindow(local.minutes, hhmmToMin(m.hours.open), hhmmToMin(m.hours.close))) fail(i, `${m.name} closed at ${s.now}`);
  if (m.offer_windows?.length && !m.offer_windows.some((w) => w.days.includes(local.day) && inWindow(local.minutes, hhmmToMin(w.start), hhmmToMin(w.end))))
    fail(i, `${m.name} outside offer window`);
  if (!(item.stock > 0)) fail(i, `${item.name} out of stock`);
  if (o.discount_pct > m.max_discount_pct) fail(i, `discount ${o.discount_pct}% over max ${m.max_discount_pct}%`);
  if (o.discount_pct <= 0) fail(i, "zero discount sent");
  if (o.final_price > (s.user.wallet_inr ?? Infinity)) fail(i, "over budget");
  if (haversineM(s.user.location, m.location) / 80 > 15) fail(i, "too far to walk");
  if ((s.user.diet ?? []).includes("veg") && !(item.tags ?? []).includes("veg")) fail(i, "non-veg item for veg user");
  if (d.economics!.incremental_profit <= 0) fail(i, "sent with no expected uplift");
  if (o.final_price !== Math.round(item.price * (1 - o.discount_pct / 100))) fail(i, "final price doesn't match discount");
  const copy = templateCopy(d.facts!);
  const g = checkGrounding(copy, d.facts!);
  if (!g.ok) fail(i, `template copy not grounded: ${g.problem}`);
}

// Grounding must reject invented numbers.
const probe = decide(presetById("priya-tuesday").build());
if (probe.facts) {
  const bad = checkGrounding({ title: "90% off!", body: `${probe.facts.merchant_name} ${probe.facts.item_name} ₹${probe.facts.final_price}` }, probe.facts);
  if (bad.ok) failures.push("grounding accepted an invented 90%");
}

// Malformed input must skip, not throw.
for (const junk of [{}, { scenario_id: "x" }, { scenario_id: "x", now: "garbage", user: {}, context: {}, merchants: "no" }]) {
  try {
    const d = decide(junk as unknown as Scenario);
    if (d.action !== "skip") failures.push(`malformed input produced ${d.action}`);
  } catch (e) {
    failures.push(`malformed input threw: ${(e as Error).message}`);
  }
}

console.log(`${N} scenarios, ${sends} sends, ${N - sends} skips`);
if (failures.length) {
  console.error(`FAILED (${failures.length}):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("All guardrails hold: 0 violations, grounding rejects invented numbers, malformed input skips safely.");
