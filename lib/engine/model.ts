// The heuristic response model. These weights are starting hypotheses (see
// blueprint, Phase 2) and are the one place to tune once real outcome data lands.

import type { Festival, Item, Merchant, Weather } from "./types";
import { clamp, logit, sigmoid } from "./util";

export const WEIGHTS = {
  intercept: -2.4,
  affinity: 2.8, // user's taste for the item's category, 0..1
  habit: 1.6, // already visits this merchant this week, 0..1
  walkPerMin: -0.11, // every minute of walking costs intent
  rating: 0.35, // per star above 4.0
};

/** Fixed cost of sending one notification (platform fee + fatigue proxy), in ₹. */
export const SEND_COST = 1.5;

/**
 * An offer must be worth at least this much expected profit (₹) after its send
 * cost. Below it, the gain is noise and the notification only teaches people to
 * ignore us.
 */
export const MIN_UPLIFT = 2.5;

/**
 * A relevant, well-timed notification lifts intent even at full price (the person
 * learns the option exists). Logit units. This is what makes a 0% "invitation"
 * worth sending to someone who wasn't going to buy, and not to someone who was.
 */
export const NOTIFY_LIFT = 0.5;

/** Margin assumed when the merchant gives neither margin nor cost. Deliberately low. */
export const ASSUMED_MARGIN = 0.2;

export function marginOf(item: Item): { margin: number; assumed: boolean } {
  if (typeof item.margin_pct === "number" && item.margin_pct > 0) {
    return { margin: clamp(item.margin_pct, 0, 0.95), assumed: false };
  }
  if (typeof item.cost === "number" && item.price > 0) {
    return { margin: clamp((item.price - item.cost) / item.price, 0, 0.95), assumed: false };
  }
  return { margin: ASSUMED_MARGIN, assumed: true };
}

export const isRainy = (w: Weather) => ["rain", "heavy_rain", "light_rain", "drizzle", "storm"].includes(w.condition);
export const isHot = (w: Weather) => w.temp_c >= 30 || w.condition === "hot";

export function contextBoost(
  item: Item,
  merchant: Merchant,
  weather: Weather,
  minutes: number,
  festival?: Festival,
): { value: number; note: string } {
  const tags = item.tags ?? [];
  const notes: string[] = [];
  let v = 0;
  const hot = isHot(weather);
  const rainy = isRainy(weather);
  if (festival && festival.categories.includes(merchant.category)) {
    v += 0.3;
    notes.push(festival.name);
  }

  if (hot && tags.includes("cold")) {
    v += 0.7;
    notes.push(`${weather.temp_c}° favours cold`);
  }
  if (hot && tags.includes("hot")) {
    v -= 0.3;
    notes.push(`${weather.temp_c}° works against hot food`);
  }
  if (rainy) {
    if (merchant.indoor) {
      v += 0.4;
      notes.push("rain favours indoor seating");
    } else {
      v -= weather.condition === "heavy_rain" ? 1.0 : 0.6;
      notes.push("rain hurts outdoor counters");
    }
    if (tags.includes("hot")) {
      v += 0.3;
      notes.push("rain favours hot food");
    }
  }
  const lunch = minutes >= 12 * 60 && minutes < 15 * 60;
  const dinner = minutes >= 19 * 60 && minutes < 22 * 60;
  if ((lunch || dinner) && tags.includes("meal")) {
    v += 0.3;
    notes.push(lunch ? "lunch hour" : "dinner hour");
  }
  if (!lunch && !dinner && tags.includes("snack")) {
    v += 0.2;
    notes.push("snack hour");
  }
  return { value: v, note: notes.join(", ") || "neutral" };
}

export function baseProbability(f: {
  affinity: number;
  habit: number;
  walkMin: number;
  rating: number;
  context: number;
}): number {
  const z =
    WEIGHTS.intercept +
    WEIGHTS.affinity * f.affinity +
    WEIGHTS.habit * f.habit +
    WEIGHTS.walkPerMin * f.walkMin +
    WEIGHTS.rating * (f.rating - 4) +
    f.context;
  return clamp(sigmoid(z), 0.01, 0.98);
}

/**
 * How strongly a discount moves this person. Price-sensitive users respond more;
 * habitual buyers respond less (they were coming anyway).
 */
export function priceSlope(sensitivity: number, habit: number): number {
  return (2 + 7 * clamp(sensitivity, 0, 1)) * (1 - 0.6 * clamp(habit, 0, 1));
}

/** Purchase odds once notified. Regulars already know the menu, so the awareness lift fades with habit. */
export function pWithDiscount(pBase: number, pct: number, slope: number, habit = 0): number {
  const lift = NOTIFY_LIFT * (1 - clamp(habit, 0, 1));
  return clamp(sigmoid(logit(pBase) + lift + (slope * pct) / 100), 0.01, 0.99);
}
