// Input hygiene and output safety. Every free-text field that reaches the engine,
// the language model or a response passes through here.
//
// Threat model: anyone can POST to /decide or the live APIs. A scenario row is
// data, never instructions, so text in it (prompt, intent, title, condition,
// tags) must not steer the decision, reach the model prompt unfiltered, or be
// echoed back verbatim.

const WEATHER = new Set(["sunny", "hot", "pleasant", "cloudy", "clear", "rain", "light_rain", "heavy_rain", "drizzle", "storm", "haze", "fog", "humid", "windy"]);

/** Known weather words only; anything else becomes "clear". */
export function cleanWeather(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return WEATHER.has(s) ? s : "clear";
}

/** Ids are short and plain. Anything else is replaced, never echoed. */
export function cleanId(v: unknown): string {
  const s = String(v ?? "").trim();
  return /^[A-Za-z0-9_.:-]{1,48}$/.test(s) ? s : "invalid-id";
}

/** Short display text: no control characters, no markup, bounded length. */
export function cleanText(v: unknown, max = 80): string {
  return String(v ?? "")
    .replace(/[\u0000-\u001f\u007f<>`{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Patterns that must never appear in a notification: links, contact details,
 * markup, and the tell-tale phrases of an injected instruction.
 */
const UNSAFE: [RegExp, string][] = [
  [/https?:\/\/|www\.|\.(com|in|net|org|io|ly)\b/i, "a link"],
  [/[\w.+-]+@[\w-]+\.\w+/, "an email address"],
  [/[<>{}`]/, "markup"],
  [/\b(ignore|disregard)\b.{0,30}\b(instruction|rule|previous|above)s?\b/i, "an injected instruction"],
  [/\b(system prompt|developer message|as an ai)\b/i, "model chatter"],
  [/\b(free|100% off|guaranteed|last chance|hurry|only today)\b/i, "an unauthorized claim"],
];

export function unsafeCopy(text: string): string | null {
  for (const [re, what] of UNSAFE) if (re.test(text)) return what;
  return null;
}

/** Categories where a personal framing could read as inferring a health need. */
export const SENSITIVE_CATEGORIES = new Set(["pharmacy", "dentist", "wellness"]);

/** "Priya Sharma" -> "Priya S." for anyone other than the customer themselves. */
export function maskName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}
