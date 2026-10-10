import type { LatLng } from "./types";

export const WALK_M_PER_MIN = 80; // ~4.8 km/h

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(p / (1 - p));
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;

/** "13:05" -> 785. Returns NaN for malformed input. */
export function hhmmToMin(s: string | undefined): number {
  if (!s) return NaN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minToHhmm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Human 12-hour time for copy: 870 -> "2:30". */
export function minToClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60) % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Reads local wall-clock time straight from an ISO string with offset.
 * We never convert through the machine's timezone, so a server in UTC and a
 * laptop in IST read "13:15+05:30" the same way.
 */
export function parseLocal(iso: string): { day: number; minutes: number; date: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const day = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay();
  return { day, minutes: Number(h) * 60 + Number(mi), date: `${y}-${mo}-${d}` };
}

/** Is `t` inside [start, end)? Handles windows that cross midnight. */
export function inWindow(t: number, start: number, end: number): boolean {
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  if (start === end) return true;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

export function daypart(min: number): "morning" | "lunch" | "afternoon" | "evening" | "night" {
  if (min < 11 * 60) return "morning";
  if (min < 15 * 60) return "lunch";
  if (min < 18 * 60) return "afternoon";
  if (min < 22 * 60) return "evening";
  return "night";
}

/** Deterministic PRNG for the simulator. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
