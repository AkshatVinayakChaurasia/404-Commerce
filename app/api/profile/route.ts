import { getViewer } from "@/lib/auth";
import { getStore, type ProfilePatch } from "@/lib/store";
import { merchantsById } from "@/lib/live/feed";
import { CATEGORIES, LANGUAGES, placeByName } from "@/lib/live/places";
import { bad } from "@/lib/live/api";
import { cleanText } from "@/lib/security";

// POST /api/profile: onboarding and settings for the signed-in user.
// { role: "customer", display_name, locality, language, interests, marketing_consent }
// { role: "merchant", merchant_id }
// The server validates everything: the shop must exist and be unclaimed, the
// area must be a known one, consent is only true when the person ticks it.
export async function POST(request: Request) {
  const v = await getViewer();
  if (!v) return bad("Sign in first", 401);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  const store = getStore();
  const patch: ProfilePatch = {};
  const name = cleanText(body.display_name, 40);
  if (name) patch.display_name = name;

  if (body.role === "merchant") {
    const mid = String(body.merchant_id ?? "");
    const shop = merchantsById.get(mid);
    if (!shop) return bad("Choose your shop from the list");
    try {
      const owner = await store.ownerOf(mid);
      if (owner && owner !== v.user.id) return bad(`${shop.name} is already managed by another account`, 409);
    } catch (e) {
      return bad((e as Error).message, 502);
    }
    Object.assign(patch, { role: "merchant", merchant_id: mid });
  } else if (body.role === "customer") {
    const place = placeByName(String(body.locality ?? ""));
    if (!place) return bad("Choose your area from the list");
    const language = String(body.language ?? "en");
    if (!(LANGUAGES as readonly string[]).includes(language)) return bad("Choose a language from the list");
    const interests = Array.isArray(body.interests) ? body.interests.map(String).filter((c) => CATEGORIES.includes(c)).slice(0, 10) : [];
    Object.assign(patch, {
      role: "customer",
      merchant_id: null,
      locality: place.name,
      lat: place.lat,
      lng: place.lng,
      language,
      interests,
      marketing_consent: body.marketing_consent === true,
    });
  } else {
    return bad("role must be customer or merchant");
  }

  try {
    const profile = await store.upsertProfile(v.user.id, patch);
    return Response.json({ profile, store: store.kind });
  } catch (e) {
    const msg = (e as Error).message;
    return bad(/duplicate key|unique/i.test(msg) ? "That shop was just taken by another account" : `Couldn't save your profile: ${msg}`, 502);
  }
}
