// The live clock. The dataset's weather feed covers one week (Mon 18 to Sun 24
// May 2026, hourly). Live mode maps the real IST weekday and time onto that week,
// so "now" always has a real weather row. Demo mode loops 8 AM to 10 PM at 30x
// speed, so a judge at midnight still sees open shops.
//
// Everything is derived from the tick number, with no stored state, so every
// server instance and every browser computes the same moment.

import { dataset } from "../official/adapter";

export const TICK_MS = 4000; // one new moment per merchant every 4 s
export type ClockMode = "live" | "demo";

const WEEK_START = 18; // Mon 18 May 2026
const DEMO_OPEN = 8 * 60;
const DEMO_SPAN = 14 * 60; // 8 AM to 10 PM
const DEMO_MIN_PER_TICK = 2; // 30x: 2 replay minutes per 4 real seconds

export const tickAt = (ms: number) => Math.floor(ms / TICK_MS);

export type Moment = { tick: number; iso: string; day: number; minutes: number; label: string };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export function momentAt(tick: number, mode: ClockMode): Moment {
  let day: number; // 0 = Sunday
  let minutes: number;
  if (mode === "live") {
    const ist = new Date(tick * TICK_MS + 5.5 * 3600 * 1000);
    day = ist.getUTCDay();
    minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  } else {
    const m = (tick * DEMO_MIN_PER_TICK) % (DEMO_SPAN * 7);
    day = (1 + Math.floor(m / DEMO_SPAN)) % 7; // starts Monday
    minutes = DEMO_OPEN + (m % DEMO_SPAN);
  }
  const date = WEEK_START + ((day + 6) % 7); // Mon=18 ... Sun=24
  const iso = `2026-05-${pad(date)}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00+05:30`;
  const h = Math.floor(minutes / 60);
  const label = `${DAY[day]} ${h % 12 === 0 ? 12 : h % 12}:${pad(minutes % 60)} ${h < 12 ? "AM" : "PM"}`;
  return { tick, iso, day, minutes, label };
}

const weatherByHour = new Map(dataset.weather_hourly.map((w) => [w.timestamp.slice(0, 13), w]));

/** The dataset's weather row for the hour of `iso`. */
export function weatherAt(iso: string): { condition: string; temp_c: number; rain_mm: number } {
  const w = weatherByHour.get(iso.slice(0, 13));
  return w ? { condition: w.condition, temp_c: w.temp_c, rain_mm: w.rain_mm } : { condition: "pleasant", temp_c: 26, rain_mm: 0 };
}
