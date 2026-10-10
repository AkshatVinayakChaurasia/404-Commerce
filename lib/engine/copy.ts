// Notification copy: deterministic templates plus the grounding check that every
// generated line (template or model) must pass before it reaches a phone.

import type { CopyFacts } from "./solve";

export type Copy = { title: string; body: string };

export function templateCopy(f: CopyFacts): Copy {
  const r = `₹${f.final_price}`;
  const was = `₹${f.base_price}`;
  if (f.language === "en") {
    switch (f.component) {
      case "HeatOfferCard":
        return {
          title: `${f.temp_c}° out. Something cold?`,
          body: `${f.item_name} at ${f.merchant_name} is ${r} today (was ${was}). ${f.walk_minutes} min walk, valid till ${f.valid_until_clock}.`,
        };
      case "RainOfferCard":
        return {
          title: "Rain outside, seats inside",
          body: `${f.merchant_name} is ${f.walk_minutes} min away. ${f.item_name} for ${r} till ${f.valid_until_clock}.`,
        };
      case "EveningOfferCard":
        return {
          title: "Evening plan sorted",
          body: `${f.item_name} at ${f.merchant_name} for ${r} (was ${was}). ${f.walk_minutes} min walk, till ${f.valid_until_clock}.`,
        };
      default:
        return {
          title: `Lunch break, ${f.user_name}?`,
          body: `${f.item_name} at ${f.merchant_name}: ${r} instead of ${was}. ${f.walk_minutes} min away, till ${f.valid_until_clock}.`,
        };
    }
  }
  switch (f.component) {
    case "HeatOfferCard":
      return {
        title: `${f.temp_c}° mein kuch thanda?`,
        body: `${f.merchant_name} ka ${f.item_name} aaj ${r} (pehle ${was}). Bas ${f.walk_minutes} min door, ${f.valid_until_clock} tak.`,
      };
    case "RainOfferCard":
      return {
        title: "Baarish bahar, seat andar",
        body: `${f.merchant_name} sirf ${f.walk_minutes} min door hai. ${f.item_name} aaj ${r}, ${f.valid_until_clock} tak.`,
      };
    case "EveningOfferCard":
      return {
        title: "Shaam ka plan ready",
        body: `${f.merchant_name} pe ${f.item_name} aaj ${r} (pehle ${was}). ${f.walk_minutes} min ka walk, ${f.valid_until_clock} tak.`,
      };
    default:
      return {
        title: `Lunch break, ${f.user_name}?`,
        body: `${f.merchant_name} pe ${f.item_name} sirf ${r} (pehle ${was}). ${f.walk_minutes} min door, ${f.valid_until_clock} tak.`,
      };
  }
}

/**
 * A line is grounded when every number in it is one the engine decided and it
 * names the merchant and the final price. Anything else is a hallucination.
 */
export function checkGrounding(c: Copy, f: CopyFacts): { ok: boolean; problem?: string } {
  const text = `${c.title} ${c.body}`;
  const allowed = new Set<string>([
    String(f.final_price),
    String(f.base_price),
    String(f.discount_pct),
    String(f.walk_minutes),
    String(f.temp_c),
    f.valid_until_clock,
  ]);
  // Names may contain digits ("Cafe 21"); they are facts too, so drop them before scanning.
  const scrubbed = text.split(f.merchant_name).join(" ").split(f.item_name).join(" ");
  const numbers = scrubbed.match(/\d+(?::\d{2})?/g) ?? [];
  const stray = numbers.filter((n) => !allowed.has(n));
  if (stray.length) return { ok: false, problem: `unapproved numbers: ${stray.join(", ")}` };
  if (!text.includes(f.merchant_name)) return { ok: false, problem: "merchant name missing" };
  if (!text.includes(String(f.final_price))) return { ok: false, problem: "final price missing" };
  if (c.title.length > 60 || c.body.length > 180) return { ok: false, problem: "too long for a notification" };
  return { ok: true };
}
