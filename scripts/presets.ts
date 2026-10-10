import { PRESETS } from "../lib/data/koramangala";
import { decide } from "../lib/engine/solve";
import { templateCopy, checkGrounding } from "../lib/engine/copy";

for (const p of PRESETS) {
  const d = decide(p.build());
  console.log(`\n== ${p.label}: ${d.action.toUpperCase()} — ${d.reason}`);
  for (const g of d.trace.gates) console.log(`  ${g.passed ? "pass" : "FAIL"} ${g.merchant_name.padEnd(17)} ${g.checks.filter(c=>!c.ok).map(c=>c.rule+": "+c.detail).join("; ")}`);
  for (const c of d.trace.candidates.slice(0, 5)) console.log(`   cand ${c.item_name.padEnd(20)} p0=${c.p_base} best=${c.best_pct}% inc=${c.best_incremental}`);
  if (d.facts) { const c = templateCopy(d.facts); console.log("  ", c.title, "|", c.body, checkGrounding(c, d.facts)); }
}
