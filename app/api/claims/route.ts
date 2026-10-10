import { customersById, merchantsById, nearbyFor } from "@/lib/live/feed";
import { momentAt, tickAt } from "@/lib/live/clock";
import { getStore } from "@/lib/store";
import { getViewer, profileToCustomer } from "@/lib/auth";
import { bad } from "@/lib/live/api";

// POST /api/claims { merchant_id, me: true, mode, minutes }        signed-in customer
// POST /api/claims { merchant_id, customer_id, mode, minutes }     demo, as a dataset customer
// The client sends ids only. The server re-decides the offer itself, so a
// tampered price or discount can never be claimed.
export async function POST(request: Request) {
  let body: { customer_id?: string; merchant_id?: string; mode?: string; minutes?: number; me?: boolean };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON: { merchant_id, me } or { merchant_id, customer_id }");
  }
  const m = merchantsById.get(String(body.merchant_id ?? ""));
  if (!m) return bad("Unknown merchant", 404);

  let record = undefined;
  let userId: string | null = null;
  let customerId = "";
  let customerName = "";
  if (body.me) {
    const v = await getViewer();
    if (!v) return bad("Sign in to claim offers for yourself", 401);
    const rec = profileToCustomer(v);
    if (!rec) return bad("Finish your profile first: choose your area", 409);
    if (!v.profile.marketing_consent) return bad("Turn on offers in your profile to claim them", 409);
    record = rec;
    userId = v.user.id;
    customerId = rec.id;
    customerName = rec.name;
  } else {
    const c = customersById.get(String(body.customer_id ?? ""));
    if (!c) return bad("Unknown customer", 404);
    customerId = c.id;
    customerName = c.name;
  }

  const store = getStore();
  const moment = momentAt(tickAt(Date.now()), body.mode === "demo" ? "demo" : "live");
  const minutes = Math.min(120, Math.max(5, Number(body.minutes) || 30));
  const rulesFor = async (id: string) => {
    if (id !== m.id) return null;
    const r = await store.getRules(id).catch(() => null);
    return r && Object.keys(r).length ? r : null;
  };
  const offers = await nearbyFor(customerId, moment, rulesFor, minutes, record);
  const o = offers.find((x) => x.merchant.id === m.id);
  if (!o || o.response.action !== "send" || !o.response.offer) {
    return bad(o ? `No offer from ${m.name} right now: ${o.response.reason}` : `${m.name} is not within a short walk`, 409);
  }
  const offer = o.response.offer;
  try {
    const claim = await store.createClaim({
      customer_id: customerId,
      customer_user_id: userId,
      customer_name: customerName,
      merchant_id: m.id,
      merchant_name: m.name,
      item_id: offer.item_id,
      item_name: o.item_name ?? offer.item_id,
      discount_pct: offer.discount_pct,
      base_price_inr: o.base_price_inr ?? offer.final_price_inr,
      final_price_inr: offer.final_price_inr,
      unit_cost_inr: o.unit_cost_inr ?? 0,
      profit_estimate_inr: o.response.profit_estimate_inr,
      valid_until: new Date(Date.now() + offer.valid_minutes * 60_000).toISOString(),
    });
    return Response.json({ claim, store: store.kind });
  } catch (e) {
    return bad(`Couldn't save the claim: ${(e as Error).message}`, 502);
  }
}
