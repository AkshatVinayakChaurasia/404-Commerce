// Who is asking. Every app API that reads or changes a person's or a shop's data
// goes through here; the browser never decides a role or an owner.

import { sessionUser, type SessionUser } from "./supabase/server";
import { getStore, type Profile } from "./store";
import type { CustomerRecord } from "./official/adapter";

export type Viewer = { user: SessionUser; profile: Profile };

export async function getViewer(): Promise<Viewer | null> {
  const user = await sessionUser();
  if (!user) return null;
  const store = getStore();
  let profile: Profile | null = null;
  try {
    profile = await store.getProfile(user.id);
    // The database trigger creates the row at first sign-in; memory mode (no
    // secret key yet) creates it here.
    profile ??= await store.upsertProfile(user.id, { display_name: user.name, avatar_url: user.avatar_url });
  } catch {
    profile = null;
  }
  return {
    user,
    profile: profile ?? {
      id: user.id,
      role: null,
      display_name: user.name,
      avatar_url: user.avatar_url,
      merchant_id: null,
      locality: null,
      lat: null,
      lng: null,
      language: "en",
      interests: [],
      marketing_consent: false,
    },
  };
}

/** A signed-in customer's profile in the shape the engine reads. */
export function profileToCustomer(v: Viewer): CustomerRecord | null {
  const p = v.profile;
  if (p.role !== "customer" || p.lat === null || p.lng === null) return null;
  return {
    id: `u_${v.user.id.slice(0, 8)}`,
    name: p.display_name || v.user.name || "You",
    age: null,
    language: p.language || "en",
    locality: p.locality ?? "",
    lat: p.lat,
    lng: p.lng,
    wallet_inr: null,
    churn_risk: null,
    price_sensitivity: 0.5,
    marketing_consent: p.marketing_consent,
    declared_preferences: p.interests,
    observed_signals: [],
    visits: {},
    avg_spend: null,
  } as unknown as CustomerRecord;
}
