// Offline evaluation: run synthetic requests through three policies and track
// merchant profit. The "true" customer response here is OUR proxy, deliberately
// different from the engine's own model (per-user noise in intent and price
// response), so the engine is scored against a world it doesn't know exactly.
// It is not the hackathon's hidden simulator.

import type { Merchant, Scenario, User } from "./types";
import { decide } from "./solve";
import { SEND_COST, marginOf, pWithDiscount, priceSlope } from "./model";
import { clamp, gaussian, logit, minToHhmm, mulberry32, sigmoid } from "./util";
import { MERCHANTS, OFFICE, offset } from "../data/koramangala";

export type PolicyId = "engine" | "max_discount" | "none";

export type SimOptions = {
  n?: number;
  seed?: number;
  focus?: string;
  overrides?: Record<string, Partial<Pick<Merchant, "max_discount_pct" | "offer_windows">>>;
};

export type LogRow = {
  i: number;
  user: string;
  time: string;
  item: string;
  merchant_id: string;
  pct: number;
  outcome: "incremental" | "subsidised" | "ignored";
  profit: number;
};

export type SimResult = {
  n: number;
  seed: number;
  series: { i: number; engine: number; max_discount: number; none: number }[];
  totals: Record<PolicyId, { sent: number; redeemed: number; discount_given: number; profit: number }>;
  skips: Record<string, number>;
  focus: {
    merchant_id: string;
    sent: number;
    redeemed: number;
    incremental_buyers: number;
    subsidised_buyers: number;
    discount_given: number;
    profit: number;
    avg_pct: number;
    by_hour: { hour: number; sent: number; redeemed: number }[];
    series: { i: number; engine: number; max_discount: number }[];
    max_discount_profit: number;
    max_discount_sent: number;
    log: LogRow[];
  };
};

const NAMES = ["Aanya", "Kabir", "Ishita", "Rahul", "Sneha", "Vikram", "Diya", "Aditya", "Nisha", "Karthik", "Pooja", "Siddharth", "Meghna", "Farhan", "Tanvi", "Rohit"];
const CATS = ["south_indian", "healthy", "coffee", "cafe", "juice", "dessert", "bakery", "chinese", "biryani"];
const MON = "2026-10-12"; // a Monday; day offsets give the rest of the week

function syntheticUser(r: () => number, i: number): User {
  const affinity: Record<string, number> = {};
  for (const c of CATS) affinity[c] = +(r() ** 1.6).toFixed(2);
  const visits: Record<string, number> = {};
  if (r() < 0.3) {
    const m = MERCHANTS[Math.floor(r() * MERCHANTS.length)];
    visits[m.id] = 1 + Math.floor(r() * 5);
    affinity[m.items[0].category] = Math.max(affinity[m.items[0].category], 0.7);
  }
  return {
    id: `sim-${i}`,
    name: NAMES[i % NAMES.length],
    location: offset(OFFICE, gaussian(r) * 500, gaussian(r) * 500),
    // Pareto-ish spend headroom: most have a few hundred, a few have a lot.
    wallet_inr: Math.round(120 + 150 / Math.max(r(), 0.08) ** 0.6),
    marketing_consent: r() < 0.85,
    language: r() < 0.8 ? "hinglish" : "en",
    category_affinity: affinity,
    visits,
    price_sensitivity: +r().toFixed(2),
    diet: r() < 0.5 ? ["veg"] : [],
  };
}

/** Simulated 7-day hourly feed: hot afternoons, rain on Wednesday and Thursday evenings. */
function weatherAt(day: number, minutes: number) {
  const h = minutes / 60;
  const temp = Math.round(25 + 8 * Math.max(0, Math.sin(((h - 8) / 12) * Math.PI)));
  const rain = (day === 3 || day === 4) && h >= 17;
  return { condition: rain ? "rain" : "clear", temp_c: rain ? temp - 6 : temp };
}

export function simulate(opts: SimOptions = {}): SimResult {
  const n = clamp(Math.floor(opts.n ?? 600), 50, 3000);
  const seed = opts.seed ?? 7;
  const focusId = opts.focus ?? "brew-bites";
  const r = mulberry32(seed);
  const merchants: Merchant[] = MERCHANTS.map((m) => ({ ...structuredClone(m), ...(opts.overrides?.[m.id] ?? {}) }));

  const cum: Record<PolicyId, number> = { engine: 0, max_discount: 0, none: 0 };
  const totals: SimResult["totals"] = {
    engine: { sent: 0, redeemed: 0, discount_given: 0, profit: 0 },
    max_discount: { sent: 0, redeemed: 0, discount_given: 0, profit: 0 },
    none: { sent: 0, redeemed: 0, discount_given: 0, profit: 0 },
  };
  const skips: Record<string, number> = {};
  const series: SimResult["series"] = [];
  const byHour = new Map<number, { sent: number; redeemed: number }>();
  const focus = { sent: 0, redeemed: 0, incremental: 0, subsidised: 0, discount: 0, profit: 0, pctSum: 0, log: [] as LogRow[] };
  const focusMax = { sent: 0, profit: 0 };
  const focusSeries: SimResult["focus"]["series"] = [];
  const every = Math.max(1, Math.floor(n / 60));

  for (let i = 0; i < n; i++) {
    const user = syntheticUser(r, i);
    const day = r() < 0.8 ? 1 + Math.floor(r() * 5) : r() < 0.5 ? 6 : 0;
    const minutes = 11 * 60 + Math.floor(r() * 630); // 11:00 to 21:30
    const lunch = minutes >= 12 * 60 && minutes < 15 * 60;
    if (lunch) user.free_until = minToHhmm(minutes + 20 + Math.floor(r() * 40));
    const date = addDays(MON, (day + 6) % 7);
    const s: Scenario = {
      scenario_id: `sim-${i}`,
      now: `${date}T${minToHhmm(minutes)}:00+05:30`,
      user,
      context: { weather: weatherAt(day, minutes) },
      merchants,
    };
    // Common random numbers: the same draw decides "would buy" across policies.
    const u = r();
    const intentNoise = gaussian(r) * 0.5;
    const slopeNoise = Math.exp(gaussian(r) * 0.35);

    const d = decide(s);
    const outcome = (merchantId: string, itemId: string, pct: number) => {
      const c = d.trace.candidates.find((x) => x.merchant_id === merchantId && x.item_id === itemId)!;
      const m = merchants.find((x) => x.id === merchantId)!;
      const item = m.items.find((x) => x.id === itemId)!;
      const { margin } = marginOf(item);
      const p0 = sigmoid(logit(c.p_base) + intentNoise);
      const slope = priceSlope(user.price_sensitivity ?? 0.5, c.habit) * slopeNoise;
      const p1 = pWithDiscount(p0, pct, slope, c.habit);
      const finalPrice = Math.round(item.price * (1 - pct / 100));
      const unit = finalPrice - item.price * (1 - margin);
      const boughtWithout = u < p0;
      const boughtWith = u < p1;
      const profit = (boughtWith ? unit : 0) - (boughtWithout ? item.price * margin : 0) - SEND_COST;
      return { boughtWith, boughtWithout, profit, discount: boughtWith ? item.price - finalPrice : 0, item };
    };

    // Policy A: our engine.
    if (d.action === "send" && d.offer) {
      const o = outcome(d.offer.merchant_id, d.offer.item_id, d.offer.discount_pct);
      cum.engine += o.profit;
      totals.engine.sent++;
      if (o.boughtWith) totals.engine.redeemed++;
      totals.engine.discount_given += o.discount;
      if (d.offer.merchant_id === focusId) {
        focus.sent++;
        focus.pctSum += d.offer.discount_pct;
        focus.profit += o.profit;
        focus.discount += o.discount;
        if (o.boughtWith) focus.redeemed++;
        if (o.boughtWith && !o.boughtWithout) focus.incremental++;
        if (o.boughtWith && o.boughtWithout) focus.subsidised++;
        const hour = Math.floor(minutes / 60);
        const h = byHour.get(hour) ?? { sent: 0, redeemed: 0 };
        h.sent++;
        if (o.boughtWith) h.redeemed++;
        byHour.set(hour, h);
        focus.log.push({
          i,
          user: user.name,
          time: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]} ${minToHhmm(minutes)}`,
          item: d.offer.item_name,
          merchant_id: d.offer.merchant_id,
          pct: d.offer.discount_pct,
          outcome: o.boughtWith ? (o.boughtWithout ? "subsidised" : "incremental") : "ignored",
          profit: Math.round(o.profit * 10) / 10,
        });
      }
    } else {
      const key = skipKey(d.reason);
      skips[key] = (skips[key] ?? 0) + 1;
    }

    // Policy B: what most coupon tools do. Most relevant item anyone can reach, max discount.
    if (d.trace.candidates.length) {
      const best = [...d.trace.candidates].sort((a, b) => b.p_base - a.p_base)[0];
      const m = merchants.find((x) => x.id === best.merchant_id)!;
      const o = outcome(best.merchant_id, best.item_id, m.max_discount_pct);
      cum.max_discount += o.profit;
      totals.max_discount.sent++;
      if (best.merchant_id === focusId) {
        focusMax.sent++;
        focusMax.profit += o.profit;
      }
      if (o.boughtWith) totals.max_discount.redeemed++;
      totals.max_discount.discount_given += o.discount;
    }

    if (i % every === 0 || i === n - 1) {
      series.push({ i: i + 1, engine: Math.round(cum.engine), max_discount: Math.round(cum.max_discount), none: 0 });
      focusSeries.push({ i: i + 1, engine: Math.round(focus.profit), max_discount: Math.round(focusMax.profit) });
    }
  }

  totals.engine.profit = Math.round(cum.engine);
  totals.max_discount.profit = Math.round(cum.max_discount);
  const hours = [];
  for (let h = 11; h <= 21; h++) hours.push({ hour: h, ...(byHour.get(h) ?? { sent: 0, redeemed: 0 }) });

  return {
    n,
    seed,
    series,
    totals,
    skips,
    focus: {
      merchant_id: focusId,
      sent: focus.sent,
      redeemed: focus.redeemed,
      incremental_buyers: focus.incremental,
      subsidised_buyers: focus.subsidised,
      discount_given: Math.round(focus.discount),
      profit: Math.round(focus.profit),
      avg_pct: focus.sent ? Math.round((focus.pctSum / focus.sent) * 10) / 10 : 0,
      by_hour: hours,
      series: focusSeries,
      max_discount_profit: Math.round(focusMax.profit),
      max_discount_sent: focusMax.sent,
      log: focus.log.slice(-12).reverse(),
    },
  };
}

function skipKey(reason: string): string {
  if (/consent/i.test(reason)) return "No consent";
  if (/anyway/i.test(reason)) return "Would buy anyway";
  if (/hard rules/i.test(reason)) return "Closed, far or outside window";
  if (/budget|diet/i.test(reason)) return "Budget or diet";
  return "No profitable discount";
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
