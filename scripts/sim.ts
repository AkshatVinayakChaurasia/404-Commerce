import { simulate } from "../lib/engine/simulate";
const t = performance.now();
const r = simulate({ n: 600 });
console.log("ms", Math.round(performance.now() - t));
console.log(JSON.stringify({ totals: r.totals, skips: r.skips, focus: { ...r.focus, log: r.focus.log.slice(0, 3) } }, null, 1));
const r2 = simulate({ n: 600, overrides: { "brew-bites": { max_discount_pct: 40 } } });
console.log("brew max40 focus", r2.focus.sent, r2.focus.avg_pct, r2.focus.profit);
