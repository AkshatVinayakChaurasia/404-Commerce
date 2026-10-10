// Bengaluru areas a signed-in customer can choose as "where I usually am".
// Each is the centre of the dataset's shops in that area, so the customer lands
// among real merchants instead of a random point.

import { dataset } from "../official/adapter";

export type Place = { name: string; lat: number; lng: number; shops: number };

const groups = new Map<string, { lat: number; lng: number }[]>();
for (const m of dataset.merchants) {
  const name = m.locality === "Koramangala 5th Block" ? "Koramangala" : m.locality;
  (groups.get(name) ?? groups.set(name, []).get(name)!).push({ lat: m.lat, lng: m.lng });
}

export const PLACES: Place[] = [...groups]
  .map(([name, pts]) => ({
    name,
    lat: +(pts.reduce((a, p) => a + p.lat, 0) / pts.length).toFixed(6),
    lng: +(pts.reduce((a, p) => a + p.lng, 0) / pts.length).toFixed(6),
    shops: pts.length,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const placeByName = (name: string) => PLACES.find((p) => p.name === name) ?? null;

export const CATEGORIES = [...new Set(dataset.merchants.map((m) => m.category))].sort();

export const LANGUAGES = ["en", "hi-en", "kn-en", "ta-en", "te-en", "hi", "kn"] as const;
