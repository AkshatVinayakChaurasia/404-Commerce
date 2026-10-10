"use client";

// Small pieces shared by the live merchant and customer views.

import type { ReactNode } from "react";

export type ClockMode = "live" | "demo";

export type LiveMoment = {
  tick: number;
  iso: string;
  label: string;
  weather: { condition: string; temp_c: number; rain_mm: number };
};

export function ModeToggle({ mode, onChange }: { mode: ClockMode; onChange: (m: ClockMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Clock" className="flex gap-1 rounded-full bg-surface-2 p-1">
      {(
        [
          ["live", "Live time"],
          ["demo", "Demo day, 30x"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={mode === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3.5 py-1.5 text-[13.5px] ${mode === v ? "bg-bg font-semibold shadow-sm" : "text-muted hover:text-text"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ClockChip({ moment, mode }: { moment: LiveMoment | null; mode: ClockMode }) {
  if (!moment) return <span className="text-[13px] text-muted">Connecting…</span>;
  const w = moment.weather;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px]">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      <span className="font-semibold">{moment.label}</span>
      <span className="text-muted">
        {Math.round(w.temp_c)}°C, {w.condition.replace("_", " ")}
        {mode === "demo" ? ", demo clock" : ""}
      </span>
    </span>
  );
}

export function StoreNote({ store, error }: { store: "supabase" | "memory" | null; error?: string | null }) {
  if (!store) return null;
  // The technical reason is for developers (/api/health); people see what it means for them.
  if (error) return <p className="rounded-[var(--radius-control)] bg-bad-tint px-3 py-2 text-[13px] text-bad">Claims can&apos;t be saved right now. The demo still works; try again in a moment.</p>;
  return store === "supabase" ? (
    <p className="text-[12.5px] text-muted">Claims and rules are saved to the database.</p>
  ) : (
    <p className="text-[12.5px] text-muted">
      Demo storage: claims and rules are kept in server memory and reset when the server restarts.
    </p>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "accent" | "ok" | "bad" }) {
  const color = tone === "accent" ? "text-accent-text" : tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="bg-surface p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`mt-1 text-[26px] font-semibold tracking-tight ${color}`}>{value}</p>
      {note && <p className="mt-0.5 text-[12.5px] text-muted">{note}</p>}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
export const hourLabel = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (hh === 24) return "midnight";
  return `${hh % 12 === 0 ? 12 : hh % 12}${mm ? `:${pad(mm)}` : ""} ${hh < 12 ? "AM" : "PM"}`;
};

export const LANG_NAME: Record<string, string> = {
  en: "English",
  "hi-en": "Hinglish",
  "kn-en": "Kannada-English",
  "ta-en": "Tamil-English",
  "te-en": "Telugu-English",
  hi: "Hindi",
  kn: "Kannada",
};

export type Poller = (() => void) & { refresh: () => void };

/**
 * Polls `url` every `ms` while the tab is visible; results go to `onData`.
 * Returns a stop function (use it as an effect cleanup) with `.refresh()` to
 * fetch immediately, e.g. when a realtime event arrives.
 */
export function startPolling(url: () => string, ms: number, onData: (d: unknown) => void, onError: (msg: string) => void): Poller {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      timer = setTimeout(run, ms);
      return;
    }
    try {
      const res = await fetch(url(), { cache: "no-store" });
      const data = await res.json();
      if (!stopped) {
        if (!res.ok) onError(data?.error ?? `Server answered ${res.status}`);
        else onData(data);
      }
    } catch {
      if (!stopped) onError("Connection lost. Retrying…");
    }
    if (!stopped) timer = setTimeout(run, ms);
  };
  run();
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
  return Object.assign(stop, {
    refresh: () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      run();
    },
  });
}
