import { feedWindow, merchantsById } from "../lib/live/feed";
import { tickAt } from "../lib/live/clock";
(async () => {
  const tick = tickAt(Date.now());
  const rows = [];
  for (const id of merchantsById.keys()) {
    const s = (await feedWindow(id, tick, 200, "demo", null)).summary;
    const m = merchantsById.get(id)!;
    rows.push({ id, name: m.name, cat: m.category, loc: m.locality, sent: s.sent, red: s.redeemed, profit: s.realized_profit_inr });
  }
  rows.sort((a, b) => b.profit - a.profit);
  for (const r of rows.slice(0, 12)) console.log(r);
  console.log("zero-send merchants:", rows.filter((r) => r.sent === 0).length);
})();
