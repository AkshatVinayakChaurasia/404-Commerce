// Converts the official PS-01 CSVs (data/official/) into one typed JSON file the
// server imports: lib/official/dataset.json. Run after replacing the CSVs:
//   npm run import-dataset
// Normalises what the raw files leave inconsistent: plural category names,
// "MER-003" vs "m_l_MER-003" ids, Python-literal visit histories, "nan" tags.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "data", "official");
const OUT = join(process.cwd(), "lib", "official", "dataset.json");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ""), r[i] ?? ""])));
}

const read = (p: string) => parseCsv(readFileSync(join(ROOT, p), "utf8"));
const num = (s: string | undefined) => (s === undefined || s === "" || s === "nan" ? null : Number(s));
const bool = (s: string) => s.trim().toLowerCase() === "true";
const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && x !== "nan");

const CATEGORY: Record<string, string> = {
  restaurants: "restaurant",
  restaurant: "restaurant",
  cafés: "cafe",
  cafes: "cafe",
  café: "cafe",
  cafe: "cafe",
  pharmacies: "pharmacy",
  pharmacy: "pharmacy",
  salons: "salon",
  salon: "salon",
  fitness: "gym",
  gym: "gym",
  gyms: "gym",
  bakeries: "bakery",
  bakery: "bakery",
  desserts: "dessert",
  dessert: "dessert",
  groceries: "grocery",
  grocery: "grocery",
  dentists: "dentist",
  dentist: "dentist",
  dental: "dentist",
  "dental care": "dentist",
  wellness: "wellness",
};
const normCat = (s: string) => CATEGORY[s.trim().toLowerCase()] ?? s.trim().toLowerCase();

const merchants = read("data/merchants.csv").map((m) => ({
  id: m.id,
  name: m.name,
  category: normCat(m.category),
  locality: m.locality,
  lat: Number(m.lat),
  lng: Number(m.lng),
  capacity: num(m.capacity),
  occupancy_pct: num(m.occupancy_pct),
  max_discount_pct: num(m.max_discount_pct) ?? 0,
  min_margin_pct: num(m.min_margin_pct) ?? 0,
  open_hour: num(m.open_hour),
  close_hour: num(m.close_hour),
  promo_start_hour: num(m.promo_start_hour),
  promo_end_hour: num(m.promo_end_hour),
  weekdays_only: bool(m.weekdays_only),
  objective: m.objective,
  languages: list(m.languages),
  inventory_signal: m.inventory_signal,
  base_price_inr: num(m.base_price_inr),
  unit_cost_inr: num(m.unit_cost_inr),
}));
const merchantIds = new Set(merchants.map((m) => m.id));

// Catalog rows for "luna" merchants say "MER-003"; the merchant row is "m_l_MER-003".
const resolveMerchant = (id: string) => (merchantIds.has(id) ? id : merchantIds.has(`m_l_${id}`) ? `m_l_${id}` : id);

const items = read("data/catalog_items.csv").map((i) => ({
  id: i.id,
  merchant_id: resolveMerchant(i.merchant_id),
  title: i.title,
  category: i.category,
  price_inr: Number(i.price_inr),
  stock_units: Number(i.stock_units),
  prep_minutes: num(i.prep_minutes),
  is_veg: bool(i.is_veg),
  tags: list(i.tags),
}));

const customers = read("data/customers.csv").map((c) => {
  const visits: Record<string, number> = {};
  for (const m of c.visit_history.matchAll(/'merchantId':\s*'([^']+)'/g)) visits[m[1]] = (visits[m[1]] ?? 0) + 1;
  return {
    id: c.id,
    name: c.name,
    age: num(c.age),
    language: c.language || "en",
    locality: c.locality,
    lat: Number(c.current_lat || c.home_lat),
    lng: Number(c.current_lng || c.home_lng),
    wallet_inr: num(c.wallet_inr),
    churn_risk: num(c.churn_risk),
    price_sensitivity: num(c.price_sensitivity),
    marketing_consent: bool(c.marketing_consent),
    declared_preferences: list(c.declared_preferences).map(normCat),
    observed_signals: list(c.observed_signals),
    visits,
    avg_spend: num(c.avg_spend),
  };
});

const scenarioRow = (s: Record<string, string>) => ({
  id: s.id,
  split: s.split,
  title: s.title,
  scenario_type: s.scenario_type,
  customer_id: s.customer_id,
  merchant_id: s.merchant_id,
  timestamp: s.timestamp,
  lat: num(s.lat),
  lng: num(s.lng),
  temp_c: num(s.temp_c),
  condition: s.condition,
  rain_mm: num(s.rain_mm),
  minutes_available: num(s.minutes_available),
  intent: s.intent,
  prompt: s.prompt,
  tags: list(s.tags),
  wallet_override: num(s.wallet_override),
  ...(s.expected_action ? { expected_action: s.expected_action, expected_reason: s.expected_reason } : {}),
});

const festivals = read("data/festivals.csv").map((f) => ({
  id: f.id,
  name: f.name,
  event_tag: f.event_tag,
  start_date: f.start_date,
  end_date: f.end_date,
  categories: list(f.categories).map(normCat),
  boost_pct: Number(f.boost_pct),
}));

const static_offers = read("data/static_offers.csv").map((o) => ({
  id: o.id,
  merchant_id: resolveMerchant(o.merchant_id),
  title: o.title,
  discount_pct: num(o.discount_pct) ?? 0,
  valid_from: o.valid_from,
  valid_to: o.valid_to,
  active: bool(o.active),
}));

const weather_hourly = read("data/weather_hourly.csv").map((w) => ({
  timestamp: w.timestamp,
  temp_c: Number(w.temp_c),
  condition: w.condition,
  rain_mm: num(w.rain_mm) ?? 0,
}));

const dataset = {
  version: JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")).version,
  merchants,
  items,
  customers,
  festivals,
  static_offers,
  weather_hourly,
  scenarios_public: read("data/scenarios_public.csv").map(scenarioRow),
  scenarios_holdout_blind: read("eval/scenarios_holdout_blind.csv").map(scenarioRow),
};

const orphanItems = items.filter((i) => !merchantIds.has(i.merchant_id)).length;
mkdirSync(join(process.cwd(), "lib", "official"), { recursive: true });
writeFileSync(OUT, JSON.stringify(dataset));
console.log(
  `dataset ${dataset.version}: ${merchants.length} merchants, ${items.length} items (${orphanItems} unlinked), ` +
    `${customers.length} customers, ${dataset.scenarios_public.length} public + ${dataset.scenarios_holdout_blind.length} blind scenarios -> ${OUT}`,
);
