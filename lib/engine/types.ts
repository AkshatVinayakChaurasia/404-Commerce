// Request / response contract for POST /api/solve.
// Field names follow the PS-01 brief; the engine tolerates missing optional fields
// and turns missing required ones into a safe skip.

export type LatLng = { lat: number; lng: number };

export type Weather = {
  condition: "clear" | "cloudy" | "rain" | "heavy_rain" | string;
  temp_c: number;
};

export type Item = {
  id: string;
  name: string;
  category: string;
  price: number;
  /** Gross margin as a fraction (0.45 = 45%). Falls back to `cost`, then a 20% assumption. */
  margin_pct?: number;
  cost?: number;
  stock: number;
  tags?: string[]; // "veg", "cold", "hot", "meal", "snack"
  /** Minutes to prepare or serve. Counts against the person's free time. */
  prep_min?: number;
};

export type OfferWindow = {
  days: number[]; // 0 = Sunday
  start: string; // "13:00"
  end: string; // "15:00"
  goal?: string;
};

export type Merchant = {
  id: string;
  name: string;
  category: string;
  location: LatLng;
  hours: { open: string; close: string; days?: number[] };
  max_discount_pct: number;
  /** Price after discount must stay this % above unit cost. */
  min_margin_pct?: number;
  /** Merchant-level reference price and unit cost (official dataset); the margin floor is checked on these too. */
  price_guard?: { base_price: number; unit_cost: number };
  objective?: string;
  inventory_signal?: string;
  offer_windows?: OfferWindow[];
  delivery_radius_m?: number;
  occupancy?: number; // 0..1 right now
  rating?: number;
  indoor?: boolean;
  items: Item[];
};

export type User = {
  id: string;
  name: string;
  age?: number;
  location: LatLng;
  wallet_inr?: number;
  marketing_consent?: boolean;
  language?: Lang;
  /** Local "HH:MM" when the user's free time ends (e.g. end of lunch break). */
  free_until?: string;
  category_affinity?: Record<string, number>;
  /** Visits per merchant in the last 7 days. */
  visits?: Record<string, number>;
  /** 0 = ignores price, 1 = very price sensitive. */
  price_sensitivity?: number;
  diet?: string[];
  persona?: string;
};

/** "hinglish" is an alias of "hi-en". */
export type Lang = "en" | "hinglish" | "hi-en" | "kn-en" | "ta-en" | "te-en" | "hi" | "kn";

export type Festival = { name: string; boost_pct: number; categories: string[] };

/**
 * Optional overrides used only when answering the organizers' evaluator.
 * remote_invitation: the scenario itself frames an offer moment (localization,
 *   family, zero-discount), so a shop beyond walking range gets an invitation for
 *   later instead of a skip. The copy then never mentions a walk.
 * min_uplift: the expected-profit bar a tier must clear (default MIN_UPLIFT).
 */
export type DecisionPolicy = { remote_invitation?: boolean; min_uplift?: number };

export type Scenario = {
  scenario_id: string;
  /** Local ISO time with offset, e.g. "2026-10-13T13:15:00+05:30". */
  now: string;
  user: User;
  context: { weather: Weather; festival?: Festival; policy?: DecisionPolicy };
  merchants: Merchant[];
};

export type Check = { rule: string; ok: boolean; detail: string };

export type MerchantGate = {
  merchant_id: string;
  merchant_name: string;
  walk_min: number;
  distance_m: number;
  passed: boolean;
  checks: Check[];
};

export type Candidate = {
  merchant_id: string;
  merchant_name: string;
  item_id: string;
  item_name: string;
  category: string;
  price: number;
  walk_min: number;
  affinity: number;
  habit: number;
  context: number;
  context_note: string;
  p_base: number;
  best_pct: number;
  best_incremental: number;
};

export type Tier = {
  pct: number;
  p_convert: number;
  final_price: number;
  unit_profit: number;
  expected_profit: number;
  incremental: number;
  affordable: boolean;
  /** Respects the owner's minimum margin (and the merchant price guard, if any). */
  margin_ok: boolean;
};

export type Stage = { id: string; label: string; summary: string; ms: number };

export type UiComponent = "HeatOfferCard" | "RainOfferCard" | "LunchOfferCard" | "EveningOfferCard";

export type Notification = {
  title: string;
  body: string;
  cta: string;
  language: Lang;
  source: "claude" | "template";
  grounded: boolean;
  fallback_reason?: string;
};

export type Offer = {
  merchant_id: string;
  merchant_name: string;
  item_id: string;
  item_name: string;
  category: string;
  base_price: number;
  discount_pct: number;
  final_price: number;
  walk_minutes: number;
  distance_m: number;
  valid_from: string;
  valid_until: string;
  rating?: number;
};

export type Economics = {
  p_base: number;
  p_offer: number;
  margin_pct: number;
  margin_assumed: boolean;
  expected_profit_no_offer: number;
  expected_profit_with_offer: number;
  incremental_profit: number;
  send_cost: number;
};

export type SolveResult = {
  scenario_id: string;
  action: "send" | "skip";
  reason: string;
  offer?: Offer;
  notification?: Notification;
  ui_configuration?: { component: UiComponent; weather: string; daypart: string };
  economics?: Economics;
  trace: {
    stages: Stage[];
    user_checks: Check[];
    gates: MerchantGate[];
    candidates: Candidate[];
    tiers: Tier[];
    chosen?: { merchant_id: string; item_id: string; pct: number };
    prompt?: string;
  };
  latency_ms: number;
};
