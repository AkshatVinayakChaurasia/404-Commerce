"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRESETS, offset, presetById } from "@/lib/data/koramangala";
import type { Lang, Scenario, SolveResult } from "@/lib/engine/types";
import { Field, Panel, Segmented, Slider, Toggle } from "@/components/ui";
import { EngineView, PhoneView } from "./engine-view";
import { inr } from "@/lib/format";

const DAYS = [
  { value: "2026-10-12", label: "Mon" },
  { value: "2026-10-13", label: "Tue" },
  { value: "2026-10-14", label: "Wed" },
  { value: "2026-10-15", label: "Thu" },
  { value: "2026-10-16", label: "Fri" },
  { value: "2026-10-17", label: "Sat" },
  { value: "2026-10-18", label: "Sun" },
];
export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "hi-en", label: "Hinglish (hi-en)" },
  { value: "en", label: "English (en)" },
  { value: "kn-en", label: "Kannada-English (kn-en)" },
  { value: "ta-en", label: "Tamil-English (ta-en)" },
  { value: "te-en", label: "Telugu-English (te-en)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "kn", label: "Kannada (kn)" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Controls = {
  date: string;
  minutes: number;
  condition: string;
  temp: number;
  moveM: number;
  wallet: number;
  consent: boolean;
  language: Lang;
  brewMax: number;
  brewStock: boolean;
};

function controlsFrom(s: Scenario): Controls {
  const [date, rest] = s.now.split("T");
  const [h, m] = rest.split(":").map(Number);
  const brew = s.merchants.find((x) => x.id === "brew-bites");
  return {
    date,
    minutes: h * 60 + m,
    condition: s.context.weather.condition,
    temp: s.context.weather.temp_c,
    moveM: 0,
    wallet: s.user.wallet_inr ?? 400,
    consent: s.user.marketing_consent === true,
    language: s.user.language === "hinglish" || !s.user.language ? "hi-en" : s.user.language,
    brewMax: brew?.max_discount_pct ?? 20,
    brewStock: (brew?.items ?? []).some((i) => i.stock > 0),
  };
}

function apply(base: Scenario, c: Controls): Scenario {
  const s = structuredClone(base);
  const hh = String(Math.floor(c.minutes / 60)).padStart(2, "0");
  const mm = String(c.minutes % 60).padStart(2, "0");
  s.now = `${c.date}T${hh}:${mm}:00+05:30`;
  s.context.weather = { condition: c.condition, temp_c: c.temp };
  s.user.location = offset(base.user.location, -c.moveM * 0.6, c.moveM * 0.8);
  s.user.wallet_inr = c.wallet;
  s.user.marketing_consent = c.consent;
  s.user.language = c.language;
  const brew = s.merchants.find((x) => x.id === "brew-bites");
  if (brew) {
    brew.max_discount_pct = c.brewMax;
    if (!c.brewStock) brew.items = brew.items.map((i) => ({ ...i, stock: 0 }));
  }
  return s;
}

const hhmm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export function Lab() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const base = useMemo(() => presetById(presetId).build(), [presetId]);
  const [controls, setControls] = useState<Controls>(() => controlsFrom(presetById(PRESETS[0].id).build()));
  const [useClaude, setUseClaude] = useState(false);
  const [claudeReady, setClaudeReady] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState(0);

  const scenario = useMemo(() => apply(base, controls), [base, controls]);
  const set = <K extends keyof Controls>(k: K, v: Controls[K]) => setControls((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setClaudeReady(Boolean(h.claude)))
      .catch(() => setClaudeReady(false));
  }, []);

  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setBusy(true);
      try {
        const res = await fetch(`/api/solve${useClaude ? "?claude=1" : ""}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scenario),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`The engine answered ${res.status}`);
        const r: SolveResult = await res.json();
        setResult(r);
        setError(null);
        setRuns((n) => n + 1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Couldn't reach /api/solve. Check that the dev server is running, then change any control to retry.");
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [scenario, useClaude]);

  function choosePreset(id: string) {
    setPresetId(id);
    setControls(controlsFrom(presetById(id).build()));
  }

  const dayName = DAY_NAMES[new Date(`${controls.date}T00:00:00Z`).getUTCDay()];
  const topCandidate = result?.trace.candidates[0];
  const brewMaxNow = scenario.merchants.find((m) => m.id === topCandidate?.merchant_id)?.max_discount_pct;

  return (
    <div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-[62ch] text-[15px] text-muted">
          Change the moment and every control calls <code className="font-mono text-[13.5px] text-text">POST /api/solve</code>{" "}
          on the Koramangala demo catalog.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Scenarios">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choosePreset(p.id)}
              aria-pressed={presetId === p.id}
              title={p.note}
              className={`rounded-full border px-3.5 py-1.5 text-[14px] transition-colors ${
                presetId === p.id ? "border-accent bg-accent-tint text-accent-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_310px]">
        {/* Controls */}
        <aside className="order-3 lg:sticky lg:top-4 lg:order-none lg:self-start">
          <Panel title="The moment">
            <div className="divide-y divide-line">
              <Segmented label="Day" value={controls.date} options={DAYS} onChange={(v) => set("date", v)} />
              <Slider label="Time" value={controls.minutes} min={7 * 60} max={23 * 60 + 55} step={5} onChange={(v) => set("minutes", v)} format={hhmm} />
              <Segmented
                label="Weather"
                value={controls.condition}
                options={[
                  { value: "clear", label: "Clear" },
                  { value: "cloudy", label: "Cloudy" },
                  { value: "rain", label: "Rain" },
                  { value: "heavy_rain", label: "Storm" },
                ]}
                onChange={(v) => set("condition", v)}
              />
              <Slider label="Temperature" value={controls.temp} min={14} max={42} onChange={(v) => set("temp", v)} format={(v) => `${v}°C`} />
            </div>
          </Panel>
          <Panel title={scenario.user.name} aside={scenario.user.age ? `${scenario.user.age}` : undefined} className="mt-5">
            <div className="divide-y divide-line">
              <Slider label="Distance from office" value={controls.moveM} min={0} max={2500} step={50} onChange={(v) => set("moveM", v)} format={(v) => (v ? `${v} m` : "at her desk")} />
              <Slider label="Wallet" value={controls.wallet} min={50} max={1500} step={10} onChange={(v) => set("wallet", v)} format={(v) => inr(v)} />
              <Toggle label="Marketing consent" checked={controls.consent} onChange={(v) => set("consent", v)} />
              <Field label="Language">
                <select
                  aria-label="Language"
                  value={controls.language}
                  onChange={(e) => set("language", e.target.value as Lang)}
                  className="w-full rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2 text-[14px]"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>
          <Panel title="Brew & Bites rules" className="mt-5">
            <div className="divide-y divide-line">
              <Slider label="Maximum discount" value={controls.brewMax} min={0} max={40} step={5} onChange={(v) => set("brewMax", v)} format={(v) => `${v}%`} />
              <Toggle label="In stock" checked={controls.brewStock} onChange={(v) => set("brewStock", v)} />
              <Toggle
                label="AI writes the copy"
                hint={claudeReady ? "The number check still applies" : "Needs an API key on the server"}
                checked={useClaude && claudeReady}
                onChange={(v) => claudeReady && setUseClaude(v)}
              />
            </div>
          </Panel>
        </aside>

        {/* Engine */}
        <div className="order-1 min-w-0 space-y-5 lg:order-none" aria-live="polite" aria-busy={busy}>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{error}</p>}

          <EngineView
            result={result}
            runs={runs}
            context={`${presetById(presetId).label}: ${dayName} ${hhmm(controls.minutes)}`}
            request={scenario}
            maxPct={brewMaxNow}
          />
        </div>

        {/* Phone */}
        <div className="order-2 lg:order-none lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4 xl:self-start">
          <PhoneView
            result={result}
            time={`${String(Math.floor(controls.minutes / 60)).padStart(2, "0")}:${String(controls.minutes % 60).padStart(2, "0")}`}
            dateLabel={`${dayName}, ${new Date(`${controls.date}T00:00:00Z`).getUTCDate()} October`}
            userName={scenario.user.name}
          />
        </div>
      </div>
    </div>
  );
}
