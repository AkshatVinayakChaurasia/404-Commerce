import { connection } from "next/server";
import { feedWindow, effectiveRules, merchantsById } from "@/lib/live/feed";
import { momentAt, tickAt, weatherAt } from "@/lib/live/clock";
import { rulesOf, type MerchantRules } from "@/lib/official/adapter";
import { getStore, type Claim } from "@/lib/store";
import { bad, modeOf } from "@/lib/live/api";
import { maskName } from "@/lib/security";
import { getViewer } from "@/lib/auth";

// GET /api/live/merchant?id=m_001&mode=live|demo
// The merchant's live feed: latest moments, a summary of the last 120, saved
// rules, and real claims from the customer app.
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const m = merchantsById.get(id);
  if (!m) return bad(`Unknown merchant ${id || "(none)"}`, 404);
  const mode = modeOf(url);
  const store = getStore();
  let override: MerchantRules | null = null;
  let claims: Claim[] = [];
  let storeError: string | null = null;
  try {
    [override, claims] = await Promise.all([store.getRules(id), store.claimsForMerchant(id, 40)]);
  } catch (e) {
    storeError = (e as Error).message;
  }
  const hasOverride = Boolean(override && Object.keys(override).length);
  let ownerId: string | null = null;
  try {
    ownerId = await store.ownerOf(id);
  } catch {
    ownerId = null;
  }
  const viewer = ownerId ? await getViewer() : null;
  const tick = tickAt(Date.now());
  const moment = momentAt(tick, mode);
  const { events, summary } = await feedWindow(id, tick, 120, mode, hasOverride ? override : null);
  return Response.json({
    store: store.kind,
    store_error: storeError,
    merchant: {
      id: m.id,
      name: m.name,
      category: m.category,
      locality: m.locality,
      objective: m.objective,
      capacity: m.capacity,
      occupancy_pct: m.occupancy_pct,
      inventory_signal: m.inventory_signal,
      open_hour: m.open_hour,
      close_hour: m.close_hour,
    },
    moment: { ...moment, weather: weatherAt(moment.iso) },
    rules: effectiveRules(id, hasOverride ? override : null),
    dataset_rules: rulesOf(m),
    overridden: hasOverride,
    // Owned shops can only be changed by their owner; unowned ones are open for the demo.
    access: { owned: Boolean(ownerId), yours: Boolean(ownerId && viewer?.user.id === ownerId) },
    events: events.slice(0, 25),
    summary,
    // A shop sees "Priya S.", never the full name or the customer id.
    claims: claims.map((c) => {
      const shown: Partial<Claim> = { ...c, customer_name: maskName(c.customer_name) };
      delete shown.customer_id;
      delete shown.customer_user_id;
      return shown;
    }),
  });
}
