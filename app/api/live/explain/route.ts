import { connection } from "next/server";
import { merchantsById, passerBy } from "@/lib/live/feed";
import { tickAt } from "@/lib/live/clock";
import { decideOfficial } from "@/lib/official/adapter";
import { getStore } from "@/lib/store";
import { bad, modeOf } from "@/lib/live/api";
import { maskName } from "@/lib/security";

// GET /api/live/explain?id=m_001&tick=123&mode=live|demo
// The full engine run behind one moment in a shop's live feed: rules checked,
// items scored, discount tiers, the copy. The Decision Lab, for that moment.
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!merchantsById.has(id)) return bad("Unknown merchant", 404);
  const tick = Number(url.searchParams.get("tick"));
  const now = tickAt(Date.now());
  // Only recent moments: the feed shows the last 120.
  if (!Number.isInteger(tick) || tick > now || tick < now - 900) return bad("That moment is no longer in the feed");
  const mode = modeOf(url);
  const rules = await getStore()
    .getRules(id)
    .catch(() => null);
  const { row, c, dist, moment } = passerBy(id, tick, mode);
  const { response, solve } = await decideOfficial(row, { rules: rules && Object.keys(rules).length ? rules : undefined });
  return Response.json({
    moment: moment.label,
    person: { name: maskName(c.name), language: c.language, distance_m: Math.round(dist) },
    response,
    engine: solve ?? null,
  });
}
