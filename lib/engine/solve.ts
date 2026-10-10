// The deterministic decision engine. Pure: no network, no clock, no randomness.
// Phase 1 hard constraints -> Phase 2 scoring -> Phase 3 discount selection.
// The LLM never runs here; it only phrases what this file decided.

import type {
  Candidate,
  Check,
  Economics,
  Item,
  Lang,
  Merchant,
  Offer,
  Scenario,
  SolveResult,
  Stage,
  Tier,
  UiComponent,
} from "./types";
import {
  WALK_M_PER_MIN,
  clamp,
  daypart,
  haversineM,
  hhmmToMin,
  inWindow,
  minToClock,
  minToHhmm,
  parseLocal,
  round,
} from "./util";
import {
  MIN_UPLIFT,
  SEND_COST,
  baseProbability,
  contextBoost,
  isHot,
  isRainy,
  marginOf,
  pWithDiscount,
  priceSlope,
} from "./model";
import { SENSITIVE_CATEGORIES, cleanText, cleanWeather } from "../security";

/** No one walks more than this for an impulse offer. */
export const MAX_WALK_MIN = 15;
/** Default minutes at the counter when an item has no prep time. */
const DEFAULT_PREP_MIN = 8;
/** Paying and picking up. */
const HANDOFF_MIN = 2;
const TIER_STEP = 5;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export type Decision = Omit<SolveResult, "notification" | "latency_ms"> & {
  facts?: CopyFacts;
};

/** Every fact the copy writer is allowed to mention. Nothing else may appear. */
export type CopyFacts = {
  user_name: string;
  language: Lang;
  merchant_name: string;
  item_name: string;
  base_price: number;
  final_price: number;
  discount_pct: number;
  walk_minutes: number;
  /** Beyond walking range (evaluator policy): the copy must not mention a walk. */
  remote?: boolean;
  /** Health-adjacent category: no personal framing that could imply a need. */
  sensitive?: boolean;
  valid_until_clock: string;
  temp_c: number;
  weather: string;
  daypart: string;
  component: UiComponent;
};

function skip(
  scenario_id: string,
  reason: string,
  trace: Decision["trace"],
): Decision {
  return { scenario_id, action: "skip", reason, trace };
}

export function decide(s: Scenario): Decision {
  const stages: Stage[] = [];
  const trace: Decision["trace"] = {
    stages,
    user_checks: [],
    gates: [],
    candidates: [],
    tiers: [],
  };
  const id = s?.scenario_id ?? "unknown";

  // ── Phase 1a: the request and the person ───────────────────────────────
  let t0 = now();
  const local = parseLocal(s?.now);
  const user = s?.user;
  const rawWeather = s?.context?.weather;
  const weather = rawWeather ? { ...rawWeather, condition: cleanWeather(rawWeather.condition) } : undefined;
  const userChecks: Check[] = [
    {
      rule: "Readable time",
      ok: !!local,
      detail: local ? `${minToHhmm(local.minutes)} local` : "`now` missing or not ISO",
    },
    {
      rule: "Marketing consent",
      ok: user?.marketing_consent === true,
      detail:
        user?.marketing_consent === true
          ? "opted in"
          : user?.marketing_consent === false
            ? "opted out"
            : "unknown, treated as no",
    },
    {
      rule: "Location known",
      ok: Number.isFinite(user?.location?.lat) && Number.isFinite(user?.location?.lng),
      detail: user?.location ? "coordinates present" : "no coordinates",
    },
    {
      rule: "Weather known",
      ok: !!weather && Number.isFinite(weather.temp_c),
      detail: weather ? `${weather.condition}, ${weather.temp_c}°C` : "no weather",
    },
  ];
  trace.user_checks = userChecks;
  const firstFail = userChecks.find((c) => !c.ok);
  stages.push({
    id: "person",
    label: "Check the person",
    summary: firstFail ? `Stopped: ${firstFail.rule.toLowerCase()} (${firstFail.detail})` : "Consent, location, time and weather present",
    ms: now() - t0,
  });
  if (firstFail || !local || !user || !weather) {
    return skip(id, firstFail ? `${firstFail.rule}: ${firstFail.detail}` : "Malformed request", trace);
  }

  const t = local.minutes;
  const freeUntil = hhmmToMin(user.free_until);
  const freeMinutes = Number.isNaN(freeUntil) ? Infinity : (freeUntil - t + 1440) % 1440;
  const wallet = typeof user.wallet_inr === "number" ? user.wallet_inr : Infinity;
  const veg = (user.diet ?? []).includes("veg");
  const policy = s.context.policy ?? {};
  const remoteOk = policy.remote_invitation === true;
  const minUplift = policy.min_uplift ?? MIN_UPLIFT;

  // ── Phase 1b: hard constraints per merchant ────────────────────────────
  t0 = now();
  // Names are display data from the request: strip markup and bound length before
  // they can reach a notification or the language model.
  const merchants = (Array.isArray(s.merchants) ? s.merchants : []).map((m) => ({
    ...m,
    name: cleanText(m?.name, 60),
    items: (Array.isArray(m?.items) ? m.items : []).map((i) => ({ ...i, name: cleanText(i?.name, 60) })),
  }));
  const open: { m: Merchant; walk: number; dist: number; windowEnd: number }[] = [];
  for (const m of merchants) {
    const dist = m?.location ? haversineM(user.location, m.location) : NaN;
    const walk = dist / WALK_M_PER_MIN;
    const checks: Check[] = [];

    const openMin = hhmmToMin(m?.hours?.open);
    const closeMin = hhmmToMin(m?.hours?.close);
    const openDay = !m?.hours?.days || m.hours.days.includes(local.day);
    const isOpen = openDay && inWindow(t, openMin, closeMin);
    checks.push({
      rule: "Open now",
      ok: isOpen,
      detail: !openDay
        ? "closed today"
        : isOpen
          ? `open till ${m.hours.close}`
          : Number.isNaN(openMin)
            ? "hours unknown"
            : `opens ${m.hours.open}, closes ${m.hours.close}`,
    });

    const windows = m?.offer_windows;
    let windowEnd = closeMin;
    let inOfferWindow = true;
    if (windows && windows.length) {
      const w = windows.find(
        (w) => w.days.includes(local.day) && inWindow(t, hhmmToMin(w.start), hhmmToMin(w.end)),
      );
      inOfferWindow = !!w;
      if (w) windowEnd = hhmmToMin(w.end);
      checks.push({
        rule: "Owner's offer window",
        ok: inOfferWindow,
        detail: w
          ? `${w.start} to ${w.end}${w.goal ? `, ${w.goal}` : ""}`
          : `only ${windows.map((w) => `${w.start} to ${w.end}`).join(", ")}`,
      });
    }

    const inStock = (m?.items ?? []).filter((i) => i.stock > 0).length;
    checks.push({
      rule: "In stock",
      ok: inStock > 0,
      detail: inStock > 0 ? `${inStock} of ${m.items.length} items available` : "everything sold out",
    });

    const radiusOk = Number.isFinite(walk) && walk <= MAX_WALK_MIN;
    const remote = remoteOk && Number.isFinite(walk) && !radiusOk;
    checks.push({
      rule: "Walkable",
      ok: radiusOk || remote,
      detail: remote
        ? `${Math.round(dist)} m away: an invitation for later, not a walk-in (scenario context)`
        : Number.isFinite(walk)
          ? `${Math.round(dist)} m, ${round(walk, 1)} min walk`
          : "no location",
    });

    const quickest = Math.min(...(m?.items ?? []).filter((i) => i.stock > 0).map((i) => i.prep_min ?? DEFAULT_PREP_MIN), Infinity);
    // Free time must cover the walk there, preparation and the handoff.
    const needed = walk + (Number.isFinite(quickest) ? quickest : DEFAULT_PREP_MIN) + HANDOFF_MIN;
    const fits = needed <= freeMinutes;
    if (Number.isFinite(freeMinutes) && !remote) {
      checks.push({
        rule: "Fits free time",
        ok: fits,
        detail: `needs ${Math.ceil(needed)} min (walk, prep, handoff), has ${freeMinutes} min`,
      });
    }

    const passed = checks.every((c) => c.ok);
    trace.gates.push({
      merchant_id: m?.id ?? "?",
      merchant_name: m?.name ?? "Unknown",
      walk_min: round(walk, 1),
      distance_m: Math.round(dist),
      passed,
      checks,
    });
    if (passed) open.push({ m, walk, dist, windowEnd });
  }
  const dropped = trace.gates.filter((g) => !g.passed).length;
  stages.push({
    id: "constraints",
    label: "Apply the rules",
    summary: `${open.length} of ${merchants.length} merchants pass; ${dropped} ruled out`,
    ms: now() - t0,
  });
  if (!open.length) {
    return skip(id, "No merchant passes the hard rules right now", trace);
  }

  // ── Phase 2 + 3: score every item, then price it ───────────────────────
  t0 = now();
  const affinity = user.category_affinity ?? {};
  const sensitivity = clamp(user.price_sensitivity ?? 0.5, 0, 1);
  type Scored = Candidate & { m: Merchant; item: Item; tiers: Tier[]; windowEnd: number; margin: number; assumed: boolean; dist: number };
  const scored: Scored[] = [];

  for (const { m, walk, dist, windowEnd } of open) {
    const habit = clamp((user.visits?.[m.id] ?? 0) / 3, 0, 1);
    for (const item of m.items ?? []) {
      if (!(item.stock > 0)) continue;
      if (veg && !(item.tags ?? []).includes("veg")) continue;
      const later = remoteOk && walk > MAX_WALK_MIN;
      if (!later && walk + (item.prep_min ?? DEFAULT_PREP_MIN) + HANDOFF_MIN > freeMinutes) continue;
      const ctx = contextBoost(item, m, weather, t, s.context.festival);
      const aff = clamp(affinity[item.category] ?? 0.2, 0, 1);
      const pBase = baseProbability({
        affinity: aff,
        habit,
        // An invitation for later is scored as if at the edge of walking range.
        walkMin: Math.min(walk, MAX_WALK_MIN),
        rating: m.rating ?? 4,
        context: ctx.value,
      });
      const slope = priceSlope(sensitivity, habit);
      const { margin, assumed } = marginOf(item);
      const baseProfit = pBase * item.price * margin;

      const tiers: Tier[] = [];
      const maxD = Math.max(0, Math.floor(m.max_discount_pct || 0));
      const floor = 1 + (m.min_margin_pct ?? 0) / 100;
      const unitCost = item.price * (1 - margin);
      // 0% is a full-price invitation; every tier above it is a real discount.
      const pcts: number[] = [0];
      for (let p = TIER_STEP; p <= maxD; p += TIER_STEP) pcts.push(p);
      if (maxD > 0 && pcts[pcts.length - 1] !== maxD) pcts.push(maxD);
      for (const pct of pcts) {
        const pOffer = pWithDiscount(pBase, pct, slope, habit);
        const finalPrice = Math.round(item.price * (1 - pct / 100));
        const unit = finalPrice - unitCost;
        const expected = pOffer * unit;
        const guard = m.price_guard;
        const marginOk =
          pct === 0 ||
          (finalPrice >= unitCost * floor &&
            (!guard || guard.base_price * (1 - pct / 100) >= guard.unit_cost * floor));
        tiers.push({
          pct,
          p_convert: round(pOffer, 3),
          final_price: finalPrice,
          unit_profit: round(unit, 1),
          expected_profit: round(expected, 1),
          incremental: round(expected - baseProfit - SEND_COST, 1),
          affordable: finalPrice <= wallet,
          margin_ok: marginOk,
        });
      }
      const valid = tiers.filter((x) => x.affordable && x.margin_ok && x.unit_profit > 0);
      const best = valid.reduce<Tier | null>((a, b) => (!a || b.incremental > a.incremental ? b : a), null);

      scored.push({
        merchant_id: m.id,
        merchant_name: m.name,
        item_id: item.id,
        item_name: item.name,
        category: item.category,
        price: item.price,
        walk_min: round(walk, 1),
        affinity: round(aff, 2),
        habit: round(habit, 2),
        context: round(ctx.value, 2),
        context_note: ctx.note,
        p_base: round(pBase, 3),
        best_pct: best?.pct ?? 0,
        best_incremental: best ? best.incremental : -Infinity,
        m,
        item,
        tiers,
        windowEnd,
        margin,
        assumed,
        dist,
      });
    }
  }
  scored.sort((a, b) => b.best_incremental - a.best_incremental);
  trace.candidates = scored.map((c) => ({
    merchant_id: c.merchant_id,
    merchant_name: c.merchant_name,
    item_id: c.item_id,
    item_name: c.item_name,
    category: c.category,
    price: c.price,
    walk_min: c.walk_min,
    affinity: c.affinity,
    habit: c.habit,
    context: c.context,
    context_note: c.context_note,
    p_base: c.p_base,
    best_pct: c.best_pct,
    best_incremental: Number.isFinite(c.best_incremental) ? c.best_incremental : 0,
  }));
  stages.push({
    id: "score",
    label: "Score the options",
    summary: scored.length
      ? `${scored.length} items scored; best is ${scored[0].item_name} at ${scored[0].merchant_name}`
      : "Nothing in stock that suits this person",
    ms: now() - t0,
  });

  const top = scored[0];
  if (!top) return skip(id, "Nothing in stock matches this person's diet and budget", trace);
  trace.tiers = top.tiers;

  t0 = now();
  const best = top.tiers.find((x) => x.pct === top.best_pct);
  if (!best || top.best_incremental < minUplift) {
    const likeliest = scored.reduce((a, b) => (b.p_base > a.p_base ? b : a));
    const reason =
      likeliest.p_base >= 0.6
        ? `${user.name} would likely buy ${likeliest.item_name} at ${likeliest.merchant_name} anyway (${Math.round(likeliest.p_base * 100)}% without an offer). A discount would only give margin away.`
        : top.tiers.every((x) => !x.affordable)
          ? `Nothing here fits ${user.name}'s wallet of ₹${wallet}, even at the deepest allowed discount.`
          : top.best_incremental > 0
            ? `Best option adds only ₹${top.best_incremental}, under the ₹${minUplift} bar. Not worth a notification.`
            : `No discount level earns back what it costs. Best case loses ₹${Math.abs(Math.round(Number.isFinite(top.best_incremental) ? top.best_incremental : 0))}.`;
    stages.push({ id: "price", label: "Pick the discount", summary: "No tier adds enough profit; skip", ms: now() - t0 });
    return skip(id, reason, trace);
  }
  stages.push({
    id: "price",
    label: "Pick the discount",
    summary:
      best.pct === 0
        ? `Full price adds ₹${best.incremental}; no discount needed${top.m.max_discount_pct ? ` (max allowed ${top.m.max_discount_pct}%)` : ""}`
        : `${best.pct}% adds ₹${best.incremental} expected profit (max allowed ${top.m.max_discount_pct}%)`,
    ms: now() - t0,
  });
  trace.chosen = { merchant_id: top.merchant_id, item_id: top.item_id, pct: best.pct };

  // ── Timing ─────────────────────────────────────────────────────────────
  const until = Math.min(
    ...[top.windowEnd, Number.isFinite(freeMinutes) ? t + freeMinutes : Infinity, t + 60].filter(Number.isFinite),
  );

  const offer: Offer = {
    merchant_id: top.merchant_id,
    merchant_name: top.merchant_name,
    item_id: top.item_id,
    item_name: top.item_name,
    category: top.category,
    base_price: top.price,
    discount_pct: best.pct,
    final_price: best.final_price,
    walk_minutes: Math.max(1, Math.round(top.walk_min)),
    distance_m: Math.round(top.dist),
    valid_from: minToHhmm(t),
    valid_until: minToHhmm(until),
    rating: top.m.rating,
  };

  const pBase = top.p_base;
  const economics: Economics = {
    p_base: pBase,
    p_offer: best.p_convert,
    margin_pct: round(top.margin, 3),
    margin_assumed: top.assumed,
    expected_profit_no_offer: round(pBase * top.price * top.margin, 1),
    expected_profit_with_offer: best.expected_profit,
    incremental_profit: best.incremental,
    send_cost: SEND_COST,
  };

  const dp = daypart(t);
  const component: UiComponent = isRainy(weather)
    ? "RainOfferCard"
    : isHot(weather) && (top.item.tags ?? []).includes("cold")
      ? "HeatOfferCard"
      : dp === "evening" || dp === "night"
        ? "EveningOfferCard"
        : "LunchOfferCard";

  const facts: CopyFacts = {
    user_name: cleanText(user.name, 24).split(" ")[0] || "there",
    sensitive: SENSITIVE_CATEGORIES.has(top.m.category),
    language: user.language === "hinglish" || !user.language ? "hi-en" : user.language,
    merchant_name: offer.merchant_name,
    item_name: offer.item_name,
    base_price: offer.base_price,
    final_price: offer.final_price,
    discount_pct: offer.discount_pct,
    walk_minutes: offer.walk_minutes,
    remote: top.walk_min > MAX_WALK_MIN,
    valid_until_clock: minToClock(until),
    temp_c: Math.round(weather.temp_c),
    weather: weather.condition,
    daypart: dp,
    component,
  };

  return {
    scenario_id: id,
    action: "send",
    reason:
      best.incremental < 0
        ? `A ${best.pct ? `${best.pct}% offer` : "full-price invitation"} to ${top.merchant_name} lifts purchase odds from ${Math.round(pBase * 100)}% to ${Math.round(best.p_convert * 100)}% and roughly pays for itself (₹${best.incremental} after the ₹${SEND_COST} send cost).`
        : best.pct === 0
        ? `A full-price invitation to ${top.merchant_name} lifts purchase odds from ${Math.round(pBase * 100)}% to ${Math.round(best.p_convert * 100)}% and adds ₹${best.incremental} expected profit; a discount would not add more.`
        : `${best.pct}% at ${top.merchant_name} lifts purchase odds from ${Math.round(pBase * 100)}% to ${Math.round(best.p_convert * 100)}% and adds ₹${best.incremental} expected profit.`,
    offer,
    economics,
    ui_configuration: { component, weather: weather.condition, daypart: dp },
    trace,
    facts,
  };
}
