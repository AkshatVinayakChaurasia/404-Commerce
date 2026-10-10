// Notification copy: deterministic templates in every language the dataset uses,
// plus the grounding check that every line (template or model) must pass before
// it reaches a phone.

import type { Lang, UiComponent } from "./types";
import type { CopyFacts } from "./solve";
import { unsafeCopy } from "../security";

export type Copy = { title: string; body: string; cta: string };

type Canon = Exclude<Lang, "hinglish">;
export const canonLang = (l: Lang | undefined): Canon => (!l || l === "hinglish" ? "hi-en" : l);

type Phrases = {
  titles: Record<UiComponent, (f: CopyFacts) => string>;
  /** Body with a discount. */
  deal: (f: CopyFacts) => string;
  /** Body for a full-price invitation. */
  plain: (f: CopyFacts) => string;
  /** Body when the shop is beyond walking range: no walk, ever. */
  remote: (f: CopyFacts, deal: boolean) => string;
  cta: [deal: string, plain: string];
};

const r = (n: number) => `₹${n}`;

const PHRASES: Record<Canon, Phrases> = {
  en: {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° out. Something cold?`,
      RainOfferCard: () => "Rain outside, seats inside",
      EveningOfferCard: () => "Your evening, sorted",
      LunchOfferCard: (f) => (f.daypart === "lunch" && !f.sensitive ? `Lunch break, ${f.user_name}?` : "A short break nearby?"),
    },
    deal: (f) => `${f.item_name} at ${f.merchant_name}: ${r(f.final_price)} instead of ${r(f.base_price)}. ${f.walk_minutes} min walk, till ${f.valid_until_clock}.`,
    plain: (f) => `${f.merchant_name} has ${f.item_name} for ${r(f.final_price)}, ${f.walk_minutes} min walk from you. Till ${f.valid_until_clock}.`,
    remote: (f, d) => (d ? `${f.item_name} at ${f.merchant_name}: ${r(f.final_price)} instead of ${r(f.base_price)}, till ${f.valid_until_clock}.` : `${f.merchant_name} has ${f.item_name} for ${r(f.final_price)}. Till ${f.valid_until_clock}.`),
    cta: ["Claim offer", "View"],
  },
  "hi-en": {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° mein kuch thanda?`,
      RainOfferCard: () => "Baarish bahar, seat andar",
      EveningOfferCard: () => "Shaam ka plan ready",
      LunchOfferCard: (f) => (f.daypart === "lunch" && !f.sensitive ? `Lunch break, ${f.user_name}?` : "Break mein kuch accha?"),
    },
    deal: (f) => `${f.merchant_name} pe ${f.item_name} aaj ${r(f.final_price)} (pehle ${r(f.base_price)}). Bas ${f.walk_minutes} min door, ${f.valid_until_clock} tak.`,
    plain: (f) => `${f.merchant_name} pe ${f.item_name} ${r(f.final_price)} mein. Bas ${f.walk_minutes} min door, ${f.valid_until_clock} tak.`,
    remote: (f, d) => (d ? `${f.merchant_name} pe ${f.item_name} aaj ${r(f.final_price)} (pehle ${r(f.base_price)}), ${f.valid_until_clock} tak.` : `${f.merchant_name} pe ${f.item_name} ${r(f.final_price)} mein, ${f.valid_until_clock} tak.`),
    cta: ["Offer lo", "Dekho"],
  },
  "kn-en": {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° bisilu, thanda enadru beka?`,
      RainOfferCard: () => "Male horage, seat olage",
      EveningOfferCard: () => "Sanje plan ready",
      LunchOfferCard: () => "Break alli enadru beka?",
    },
    deal: (f) => `${f.merchant_name} alli ${f.item_name} ivattu ${r(f.final_price)} mathra (munche ${r(f.base_price)}). ${f.walk_minutes} nimisha nadige, ${f.valid_until_clock} varege.`,
    plain: (f) => `${f.merchant_name} alli ${f.item_name} ${r(f.final_price)}. ${f.walk_minutes} nimisha nadige, ${f.valid_until_clock} varege.`,
    remote: (f, d) => (d ? `${f.merchant_name} alli ${f.item_name} ivattu ${r(f.final_price)} mathra (munche ${r(f.base_price)}), ${f.valid_until_clock} varege.` : `${f.merchant_name} alli ${f.item_name} ${r(f.final_price)}, ${f.valid_until_clock} varege.`),
    cta: ["Offer thagoli", "Nodi"],
  },
  "ta-en": {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° veyil, edhavadhu cool-aa?`,
      RainOfferCard: () => "Mazhai veliya, seat ulla",
      EveningOfferCard: () => "Saayangaalam plan ready",
      LunchOfferCard: () => "Break-la edhavadhu venuma?",
    },
    deal: (f) => `${f.merchant_name}-la ${f.item_name} inniku ${r(f.final_price)} dhaan (munnadi ${r(f.base_price)}). ${f.walk_minutes} nimisham nadai, ${f.valid_until_clock} varaikkum.`,
    plain: (f) => `${f.merchant_name}-la ${f.item_name} ${r(f.final_price)}. ${f.walk_minutes} nimisham nadai, ${f.valid_until_clock} varaikkum.`,
    remote: (f, d) => (d ? `${f.merchant_name}-la ${f.item_name} inniku ${r(f.final_price)} dhaan (munnadi ${r(f.base_price)}), ${f.valid_until_clock} varaikkum.` : `${f.merchant_name}-la ${f.item_name} ${r(f.final_price)}, ${f.valid_until_clock} varaikkum.`),
    cta: ["Offer edunga", "Paarunga"],
  },
  "te-en": {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° endaa, emaina chalaga?`,
      RainOfferCard: () => "Vaana bayata, seat lopala",
      EveningOfferCard: () => "Saayantram plan ready",
      LunchOfferCard: () => "Break lo emaina kavala?",
    },
    deal: (f) => `${f.merchant_name} lo ${f.item_name} ivala ${r(f.final_price)} matrame (mundu ${r(f.base_price)}). ${f.walk_minutes} nimishala nadaka, ${f.valid_until_clock} varaku.`,
    plain: (f) => `${f.merchant_name} lo ${f.item_name} ${r(f.final_price)}. ${f.walk_minutes} nimishala nadaka, ${f.valid_until_clock} varaku.`,
    remote: (f, d) => (d ? `${f.merchant_name} lo ${f.item_name} ivala ${r(f.final_price)} matrame (mundu ${r(f.base_price)}), ${f.valid_until_clock} varaku.` : `${f.merchant_name} lo ${f.item_name} ${r(f.final_price)}, ${f.valid_until_clock} varaku.`),
    cta: ["Offer teesukondi", "Choodandi"],
  },
  hi: {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° में कुछ ठंडा?`,
      RainOfferCard: () => "बाहर बारिश, अंदर सीट",
      EveningOfferCard: () => "शाम का प्लान तैयार",
      LunchOfferCard: () => "ब्रेक में कुछ अच्छा?",
    },
    deal: (f) => `${f.merchant_name} पर ${f.item_name} आज ${r(f.final_price)} (पहले ${r(f.base_price)})। बस ${f.walk_minutes} मिनट दूर, ${f.valid_until_clock} तक।`,
    plain: (f) => `${f.merchant_name} पर ${f.item_name} ${r(f.final_price)} में। बस ${f.walk_minutes} मिनट दूर, ${f.valid_until_clock} तक।`,
    remote: (f, d) => (d ? `${f.merchant_name} पर ${f.item_name} आज ${r(f.final_price)} (पहले ${r(f.base_price)}), ${f.valid_until_clock} तक।` : `${f.merchant_name} पर ${f.item_name} ${r(f.final_price)} में, ${f.valid_until_clock} तक।`),
    cta: ["ऑफ़र लें", "देखें"],
  },
  kn: {
    titles: {
      HeatOfferCard: (f) => `${f.temp_c}° ಬಿಸಿಲು, ತಂಪಾಗಿ ಏನಾದ್ರೂ?`,
      RainOfferCard: () => "ಹೊರಗೆ ಮಳೆ, ಒಳಗೆ ಸೀಟು",
      EveningOfferCard: () => "ಸಂಜೆಯ ಪ್ಲಾನ್ ರೆಡಿ",
      LunchOfferCard: () => "ಬ್ರೇಕ್‌ನಲ್ಲಿ ಏನಾದ್ರೂ?",
    },
    deal: (f) => `${f.merchant_name} ನಲ್ಲಿ ${f.item_name} ಇವತ್ತು ${r(f.final_price)} ಮಾತ್ರ (ಮುಂಚೆ ${r(f.base_price)}). ${f.walk_minutes} ನಿಮಿಷ ನಡಿಗೆ, ${f.valid_until_clock} ರವರೆಗೆ.`,
    plain: (f) => `${f.merchant_name} ನಲ್ಲಿ ${f.item_name} ${r(f.final_price)}. ${f.walk_minutes} ನಿಮಿಷ ನಡಿಗೆ, ${f.valid_until_clock} ರವರೆಗೆ.`,
    remote: (f, d) => (d ? `${f.merchant_name} ನಲ್ಲಿ ${f.item_name} ಇವತ್ತು ${r(f.final_price)} ಮಾತ್ರ (ಮುಂಚೆ ${r(f.base_price)}), ${f.valid_until_clock} ರವರೆಗೆ.` : `${f.merchant_name} ನಲ್ಲಿ ${f.item_name} ${r(f.final_price)}, ${f.valid_until_clock} ರವರೆಗೆ.`),
    cta: ["ಆಫರ್ ಪಡೆಯಿರಿ", "ನೋಡಿ"],
  },
};

export function templateCopy(f: CopyFacts): Copy {
  const p = PHRASES[canonLang(f.language)];
  const deal = f.discount_pct > 0;
  return {
    title: p.titles[f.component](f),
    body: f.remote ? p.remote(f, deal) : deal ? p.deal(f) : p.plain(f),
    cta: deal ? p.cta[0] : p.cta[1],
  };
}

/**
 * A line is grounded when every number in it is one the engine decided and it
 * names the merchant and the final price. Anything else is a hallucination.
 */
export function checkGrounding(c: { title: string; body: string }, f: CopyFacts): { ok: boolean; problem?: string } {
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
  const scrubbed = text.split(f.merchant_name).join(" ").split(f.item_name).join(" ").split(f.user_name).join(" ");
  const numbers = scrubbed.match(/\d+(?::\d{2})?/g) ?? [];
  const stray = numbers.filter((n) => !allowed.has(n));
  if (stray.length) return { ok: false, problem: `unapproved numbers: ${stray.join(", ")}` };
  if (!text.includes(f.merchant_name)) return { ok: false, problem: "merchant name missing" };
  if (!text.includes(String(f.final_price))) return { ok: false, problem: "final price missing" };
  if (c.title.length > 60 || c.body.length > 200) return { ok: false, problem: "too long for a notification" };
  const unsafe = unsafeCopy(text);
  if (unsafe) return { ok: false, problem: `contains ${unsafe}` };
  return { ok: true };
}
