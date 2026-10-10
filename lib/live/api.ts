// Shared helpers for the live API routes.
import type { ClockMode } from "./clock";
import type { MerchantRules } from "../official/adapter";

export const modeOf = (url: URL): ClockMode => (url.searchParams.get("mode") === "demo" ? "demo" : "live");

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Accept only known rule fields with sane ranges; anything else is dropped. */
export function cleanRules(input: unknown): MerchantRules | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const out: MerchantRules = {};
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  const md = num(r.max_discount_pct, 0, 60);
  if (md !== undefined) out.max_discount_pct = Math.round(md);
  const mm = num(r.min_margin_pct, 0, 80);
  if (mm !== undefined) out.min_margin_pct = Math.round(mm);
  if (r.promo_start_hour === null && r.promo_end_hour === null) {
    // "No promotion window" is stored as all day, so it never reads as "not set".
    out.promo_start_hour = 0;
    out.promo_end_hour = 24;
  } else {
    const ps = num(r.promo_start_hour, 0, 23.5);
    const pe = num(r.promo_end_hour, 0.5, 24);
    if (ps !== undefined && pe !== undefined && pe > ps) {
      out.promo_start_hour = ps;
      out.promo_end_hour = pe;
    }
  }
  if (typeof r.weekdays_only === "boolean") out.weekdays_only = r.weekdays_only;
  if (typeof r.paused === "boolean") out.paused = r.paused;
  return out;
}
