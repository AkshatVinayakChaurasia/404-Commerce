// Live decisions on the official dataset.
//
// Merchant feed: every tick, one real customer profile from customers.csv walks
// past the shop (position simulated within 1.5 km, everything else from the
// data). The engine decides with the merchant's current rules and the dataset
// weather for that hour. Whether the person then claims and redeems is a
// simulated draw from the engine's own odds, and the UI says so. Real claims from
// the customer app are stored separately (lib/store) and shown alongside.
//
// Customer view: the customer's real dataset location, every merchant within a
// short walk, decided now.
//
// All of it is a pure function of (merchant or customer, tick, mode, rules), so
// any server instance returns the same answer.

import { dataset, decideOfficial, rulesOf, type CustomerRecord, type MerchantRules, type OfficialResponse } from "../official/adapter";
import { haversineM, mulberry32 } from "../engine/util";
import { SEND_COST } from "../engine/model";
import { momentAt, weatherAt, type ClockMode, type Moment } from "./clock";

export const merchantsById = new Map(dataset.merchants.map((m) => [m.id, m]));
export const customersById = new Map(dataset.customers.map((c) => [c.id, c]));
const itemsById = new Map(dataset.items.map((i) => [i.id, i]));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type Outcome = "redeemed" | "claimed" | "ignored" | "skipped";

export type FeedEvent = {
  tick: number;
  time: string;
  customer: { id: string; name: string; language: string };
  distance_m: number;
  action: "send" | "skip";
  reason: string;
  offer: { item_name: string; discount_pct: number; final_price_inr: number; base_price_inr: number } | null;
  notification: { title: string; body: string; language: string } | null;
  outcome: Outcome;
  /** Bought because of the offer (would not have at full price without it). */
  incremental: boolean;
  profit_estimate_inr: number | null;
  /** Margin actually earned if redeemed, minus the send cost; send cost alone otherwise. */
  realized_profit_inr: number;
};

const cache = new Map<string, FeedEvent>();

/**
 * Who walks past `merchantId` at `tick`, and the scenario row the engine sees.
 * The person and their response draws depend only on shop, tick and clock, so
 * changing a rule changes the decision for the same passer-by, not who passes.
 * Returns the PRNG so the caller continues the same draw sequence.
 */
export function passerBy(merchantId: string, tick: number, mode: ClockMode) {
  const m = merchantsById.get(merchantId)!;
  const r = mulberry32(hash(`${merchantId}|${tick}|${mode}`));
  const c = dataset.customers[Math.floor(r() * dataset.customers.length)];
  const dist = 120 + r() * 1380;
  const angle = r() * Math.PI * 2;
  const moment = momentAt(tick, mode);
  const w = weatherAt(moment.iso);
  const minutes = 10 + Math.floor(r() * 50);
  const row = {
    id: `live-${merchantId}-${tick}`,
    customer_id: c.id,
    merchant_id: m.id,
    timestamp: moment.iso,
    lat: m.lat + (dist * Math.sin(angle)) / 110_600,
    lng: m.lng + (dist * Math.cos(angle)) / 108_500,
    temp_c: w.temp_c,
    condition: w.condition,
    rain_mm: w.rain_mm,
    minutes_available: minutes,
    scenario_type: "live",
  };
  return { row, r, c, dist, moment };
}
const rulesKey = (r: MerchantRules | null | undefined) => (r && Object.keys(r).length ? JSON.stringify(r) : "-");

export async function eventFor(merchantId: string, tick: number, mode: ClockMode, rules: MerchantRules | null): Promise<FeedEvent> {
  const key = `${merchantId}|${tick}|${mode}|${rulesKey(rules)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const { row, r, c, dist, moment } = passerBy(merchantId, tick, mode);
  const { response, solve } = await decideOfficial(row, { rules: rules ?? undefined });

  let outcome: Outcome = "skipped";
  let incremental = false;
  let realized = 0;
  if (response.action === "send" && solve?.economics && response.offer) {
    const u = r();
    const claimed = u < solve.economics.p_offer;
    const redeemed = claimed && r() < 0.85;
    outcome = redeemed ? "redeemed" : claimed ? "claimed" : "ignored";
    incremental = redeemed && u >= solve.economics.p_base;
    const base = solve.offer!.base_price;
    const cost = base * (1 - solve.economics.margin_pct);
    realized = (redeemed ? response.offer.final_price_inr - cost : 0) - SEND_COST;
  }

  const event: FeedEvent = {
    tick,
    time: moment.label,
    customer: { id: c.id, name: c.name.split(" ")[0], language: c.language },
    distance_m: Math.round(dist),
    action: response.action,
    reason: response.reason,
    offer:
      response.offer && solve?.offer
        ? {
            item_name: solve.offer.item_name,
            discount_pct: response.offer.discount_pct,
            final_price_inr: response.offer.final_price_inr,
            base_price_inr: solve.offer.base_price,
          }
        : null,
    notification: response.notification ? { title: response.notification.title, body: response.notification.body, language: response.notification.language } : null,
    outcome,
    incremental,
    profit_estimate_inr: response.profit_estimate_inr,
    realized_profit_inr: Math.round(realized * 10) / 10,
  };
  if (cache.size > 20_000) cache.clear();
  cache.set(key, event);
  return event;
}

export type FeedSummary = {
  moments: number;
  sent: number;
  skipped: number;
  claimed: number;
  redeemed: number;
  incremental: number;
  realized_profit_inr: number;
  avg_discount_pct: number;
  skip_reasons: { reason: string; count: number }[];
};

export async function feedWindow(merchantId: string, endTick: number, count: number, mode: ClockMode, rules: MerchantRules | null) {
  const events: FeedEvent[] = [];
  for (let t = endTick - count + 1; t <= endTick; t++) events.push(await eventFor(merchantId, t, mode, rules));
  const sent = events.filter((e) => e.action === "send");
  const reasons = new Map<string, number>();
  for (const e of events) if (e.action === "skip") reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1);
  const summary: FeedSummary = {
    moments: events.length,
    sent: sent.length,
    skipped: events.length - sent.length,
    claimed: sent.filter((e) => e.outcome === "claimed" || e.outcome === "redeemed").length,
    redeemed: sent.filter((e) => e.outcome === "redeemed").length,
    incremental: sent.filter((e) => e.incremental).length,
    realized_profit_inr: Math.round(events.reduce((a, e) => a + e.realized_profit_inr, 0)),
    avg_discount_pct: sent.length ? Math.round((sent.reduce((a, e) => a + (e.offer?.discount_pct ?? 0), 0) / sent.length) * 10) / 10 : 0,
    skip_reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 4),
  };
  return { events: events.reverse(), summary };
}

export type NearbyOffer = {
  merchant: { id: string; name: string; category: string; locality: string };
  distance_m: number;
  response: OfficialResponse;
  item_name: string | null;
  base_price_inr: number | null;
  unit_cost_inr: number | null;
};

export const NEARBY_M = 1500;

/** Every merchant within a short walk of the customer's dataset location, decided at `moment`. */
export async function nearbyFor(
  customerId: string,
  moment: Moment,
  rulesFor: (merchantId: string) => Promise<MerchantRules | null>,
  minutesAvailable = 30,
  record?: CustomerRecord,
): Promise<NearbyOffer[]> {
  const c = record ?? customersById.get(customerId);
  if (!c) return [];
  const w = weatherAt(moment.iso);
  const near = dataset.merchants
    .map((m) => ({ m, d: haversineM({ lat: c.lat, lng: c.lng }, { lat: m.lat, lng: m.lng }) }))
    .filter((x) => x.d <= NEARBY_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);
  const out: NearbyOffer[] = [];
  for (const { m, d } of near) {
    const rules = await rulesFor(m.id);
    const { response, solve } = await decideOfficial(
      {
        id: `nearby-${c.id}-${m.id}-${moment.tick}`,
        customer_id: c.id,
        merchant_id: m.id,
        timestamp: moment.iso,
        lat: c.lat,
        lng: c.lng,
        temp_c: w.temp_c,
        condition: w.condition,
        rain_mm: w.rain_mm,
        minutes_available: minutesAvailable,
        scenario_type: "live",
      },
      { rules: rules ?? undefined, customer: record },
    );
    const item = response.offer ? itemsById.get(response.offer.item_id) : undefined;
    out.push({
      merchant: { id: m.id, name: m.name, category: m.category, locality: m.locality },
      distance_m: Math.round(d),
      response,
      item_name: item?.title ?? null,
      base_price_inr: solve?.offer?.base_price ?? null,
      unit_cost_inr: solve?.offer && solve.economics ? Math.round(solve.offer.base_price * (1 - solve.economics.margin_pct) * 100) / 100 : null,
    });
  }
  return out.sort((a, b) =>
    a.response.action === b.response.action
      ? (b.response.profit_estimate_inr ?? 0) - (a.response.profit_estimate_inr ?? 0) || a.distance_m - b.distance_m
      : a.response.action === "send"
        ? -1
        : 1,
  );
}

export const effectiveRules = (merchantId: string, override: MerchantRules | null) => {
  const m = merchantsById.get(merchantId);
  return m ? { ...rulesOf(m), ...(override ?? {}) } : null;
};
