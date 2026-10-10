import { connection } from "next/server";
import { customersById, nearbyFor, NEARBY_M } from "@/lib/live/feed";
import { momentAt, tickAt, weatherAt } from "@/lib/live/clock";
import type { CustomerRecord, MerchantRules } from "@/lib/official/adapter";
import { getStore, type Claim } from "@/lib/store";
import { getViewer, profileToCustomer } from "@/lib/auth";
import { bad, modeOf } from "@/lib/live/api";

// GET /api/live/customer?me=1&mode=live|demo&minutes=30      the signed-in customer
// GET /api/live/customer?id=c_001&mode=live|demo&minutes=30  demo, as a dataset customer
// Offers right now from every merchant within a short walk.
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const mode = modeOf(url);
  const minutes = Math.min(120, Math.max(5, Number(url.searchParams.get("minutes")) || 30));
  const store = getStore();

  let record: CustomerRecord | undefined;
  let userId: string | null = null;
  let id = url.searchParams.get("id") ?? "";
  if (url.searchParams.get("me") === "1") {
    const v = await getViewer();
    if (!v) return bad("Sign in to see offers for you", 401);
    const rec = profileToCustomer(v);
    if (!rec) return bad("Finish your profile: choose your area", 409);
    record = rec;
    userId = v.user.id;
    id = rec.id;
  } else if (!customersById.get(id)) {
    return bad(`Unknown customer ${id ? "" : "(none)"}`.trim(), 404);
  }
  const c = record ?? customersById.get(id)!;

  const moment = momentAt(tickAt(Date.now()), mode);
  const rulesCache = new Map<string, MerchantRules | null>();
  let storeError: string | null = null;
  const rulesFor = async (mid: string) => {
    if (!rulesCache.has(mid)) {
      try {
        const r = await store.getRules(mid);
        rulesCache.set(mid, r && Object.keys(r).length ? r : null);
      } catch (e) {
        storeError = (e as Error).message;
        rulesCache.set(mid, null);
      }
    }
    return rulesCache.get(mid) ?? null;
  };
  const nearby = await nearbyFor(id, moment, rulesFor, minutes, record);
  let claims: Claim[] = [];
  try {
    claims = userId ? await store.claimsForUser(userId, 10) : await store.claimsForCustomer(id, 10);
  } catch (e) {
    storeError = (e as Error).message;
  }
  return Response.json({
    store: store.kind,
    store_error: storeError,
    me: Boolean(userId),
    customer: {
      id: c.id,
      // Only what the phone needs. Age, exact wallet and coordinates stay on the server.
      name: c.name,
      language: c.language,
      locality: c.locality,
      marketing_consent: c.marketing_consent,
      declared_preferences: c.declared_preferences,
    },
    moment: { ...moment, weather: weatherAt(moment.iso) },
    radius_m: NEARBY_M,
    minutes_available: minutes,
    nearby,
    claims: claims.map((cl) => ({ ...cl, customer_user_id: undefined })),
  });
}
