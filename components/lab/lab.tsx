"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PRESETS, offset, presetById } from "@/lib/data/koramangala";
import type { Scenario, SolveResult, Tier } from "@/lib/engine/types";
import { Chip, Panel, Segmented, Slider, Toggle } from "@/components/ui";
import { LockScreen, OfferScreen, Phone } from "@/components/phone";
import { inr, pct, shortFail } from "@/lib/format";
import { SEND_COST } from "@/lib/engine/model";

const DAYS = [
  { value: "2026-10-12", label: "Mon" },
  { value: "2026-10-13", label: "Tue" },
  { value: "2026-10-14", label: "Wed" },
  { value: "2026-10-15", label: "Thu" },
  { value: "2026-10-16", label: "Fri" },
  { value: "2026-10-17", label: "Sat" },
  { value: "2026-10-18", label: "Sun" },
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
  language: "hinglish" | "en";
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
    language: s.user.language ?? "hinglish",
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
  const [screen, setScreen] = useState<"lock" | "offer">("lock");
  const [runs, setRuns] = useState(0);
  const reduce = useReducedMotion();

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

  const sent = result?.action === "send";
  const chosenKey = result?.trace.chosen ? `${result.trace.chosen.merchant_id}/${result.trace.chosen.item_id}` : "";
  const dayName = DAY_NAMES[new Date(`${controls.date}T00:00:00Z`).getUTCDay()];
  const topCandidate = result?.trace.candidates[0];
  const brewMaxNow = scenario.merchants.find((m) => m.id === topCandidate?.merchant_id)?.max_discount_pct;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-8">
      <div className="flex flex-col gap-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="title text-[clamp(32px,4vw,48px)]">Decision Lab</h1>
          <p className="mt-2 max-w-[62ch] text-[16px] text-muted">
            Every change calls the real <code className="font-mono text-[14px] text-text">POST /api/solve</code>. Nothing
            here is animated from a script: the pipeline, scores and phone come from the response.
          </p>
        </div>
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
              <Slider label="UPI wallet" value={controls.wallet} min={50} max={1500} step={10} onChange={(v) => set("wallet", v)} format={(v) => inr(v)} />
              <Toggle label="Marketing consent" checked={controls.consent} onChange={(v) => set("consent", v)} />
              <Segmented
                label="Language"
                value={controls.language}
                options={[
                  { value: "hinglish", label: "Hinglish" },
                  { value: "en", label: "English" },
                ]}
                onChange={(v) => set("language", v)}
              />
            </div>
          </Panel>
          <Panel title="Brew & Bites rules" className="mt-5">
            <div className="divide-y divide-line">
              <Slider label="Maximum discount" value={controls.brewMax} min={0} max={40} step={5} onChange={(v) => set("brewMax", v)} format={(v) => `${v}%`} />
              <Toggle label="In stock" checked={controls.brewStock} onChange={(v) => set("brewStock", v)} />
              <Toggle
                label="Claude writes the copy"
                hint={claudeReady ? "Grounding check still applies" : "Add ANTHROPIC_API_KEY to enable"}
                checked={useClaude && claudeReady}
                onChange={(v) => claudeReady && setUseClaude(v)}
              />
            </div>
          </Panel>
        </aside>

        {/* Engine */}
        <div className="order-1 min-w-0 space-y-5 lg:order-none" aria-live="polite" aria-busy={busy}>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{error}</p>}

          <section className="rounded-[var(--radius-panel)] border border-line bg-surface p-6">
            {result ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${result.action}-${result.reason}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Chip tone={sent ? "accent" : "bad"}>{sent ? "Send" : "Skip"}</Chip>
                    <span className="text-[13px] text-muted">
                      {presetById(presetId).label}: {dayName} {hhmm(controls.minutes)}, answered in {result.latency_ms} ms
                    </span>
                  </div>
                  <p className="title mt-3 text-[clamp(22px,2.4vw,30px)]">
                    {sent && result.offer
                      ? `${result.offer.discount_pct}% off ${result.offer.item_name} at ${result.offer.merchant_name}`
                      : "No offer goes out"}
                  </p>
                  <p className="mt-2 max-w-[70ch] text-[16px] text-muted">{result.reason}</p>
                </motion.div>
              </AnimatePresence>
            ) : (
              <p className="text-muted">Running the engine…</p>
            )}

            {result && (
              <ol className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
                {result.trace.stages.map((s, i) => (
                  <motion.li
                    key={`${runs}-${s.id}`}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : i * 0.08, duration: 0.3 }}
                    className="rounded-[14px] border border-line bg-bg/40 p-3"
                  >
                    <p className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[11px]">{i + 1}</span>
                      {s.label}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-snug text-muted">{s.summary}</p>
                  </motion.li>
                ))}
              </ol>
            )}
          </section>

          {result && result.trace.gates.length > 0 && (
            <Panel title="Hard rules" aside={`${result.trace.gates.filter((g) => g.passed).length} of ${result.trace.gates.length} merchants pass`}>
              <ul className="divide-y divide-line">
                {result.trace.gates.map((g) => {
                  const fails = g.checks.filter((c) => !c.ok);
                  return (
                    <li key={g.merchant_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${g.passed ? "bg-ok" : "bg-bad"}`} aria-hidden="true" />
                      <span className="min-w-[150px] text-[15px] font-medium">{g.merchant_name}</span>
                      <span className="w-[86px] text-[13px] text-muted">{Number.isFinite(g.walk_min) ? `${g.walk_min} min walk` : ""}</span>
                      <span className="flex flex-1 flex-wrap gap-1.5">
                        {g.passed ? (
                          <Chip tone="ok">Passes all {g.checks.length} rules</Chip>
                        ) : (
                          fails.map((c) => (
                            <Chip key={c.rule} tone="bad">
                              {c.rule}: {c.detail}
                            </Chip>
                          ))
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {result && result.trace.user_checks.some((c) => !c.ok) && (
            <Panel title="Person checks">
              <ul className="flex flex-wrap gap-2">
                {result.trace.user_checks.map((c) => (
                  <li key={c.rule}>
                    <Chip tone={c.ok ? "ok" : "bad"}>
                      {c.rule}: {c.detail}
                    </Chip>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {result && result.trace.candidates.length > 0 && (
            <Panel title="Scores" aside="Odds of buying without any offer">
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[500px] text-left text-[14px]">
                  <thead className="whitespace-nowrap text-[12.5px] text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 pr-3 font-medium">Taste</th>
                      <th className="py-2 pr-3 font-medium">Habit</th>
                      <th className="py-2 pr-3 font-medium">Walk</th>
                      <th className="py-2 pr-3 text-right font-medium">Buys anyway</th>
                      <th className="py-2 text-right font-medium">Best offer adds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trace.candidates.map((c) => {
                      const chosen = `${c.merchant_id}/${c.item_id}` === chosenKey;
                      return (
                        <tr key={`${c.merchant_id}/${c.item_id}`} className={`border-b border-line last:border-0 ${chosen ? "bg-accent-tint" : ""}`}>
                          <td className="py-2.5 pr-3">
                            <span className="font-medium">{c.item_name}</span>
                            <span className="block text-[12.5px] text-muted">
                              {c.merchant_name}
                              {c.context_note !== "neutral" ? `, ${c.context_note}` : ""}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <Meter v={c.affinity} />
                          </td>
                          <td className="py-2.5 pr-3">
                            <Meter v={c.habit} />
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-muted">{c.walk_min} min</td>
                          <td className="py-2.5 pr-3 text-right font-semibold">{pct(c.p_base)}</td>
                          <td className={`whitespace-nowrap py-2.5 text-right font-semibold ${c.best_incremental > 0 ? (chosen ? "text-accent-text" : "") : "text-bad"}`}>
                            {c.best_pct ? `${inr(c.best_incremental, 1)} at ${c.best_pct}%` : "nothing affordable"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {result && result.trace.tiers.length > 0 && topCandidate && (
            <Panel
              title="Discount tiers"
              aside={`${topCandidate.item_name}, extra profit after a ${inr(SEND_COST, 1)} send cost`}
            >
              <TierChart tiers={result.trace.tiers} chosen={result.trace.chosen?.pct} max={brewMaxNow} />
              {result.economics && (
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
                  <Econ label="Buys without offer" value={pct(result.economics.p_base)} />
                  <Econ label="Buys with offer" value={pct(result.economics.p_offer)} />
                  <Econ label={result.economics.margin_assumed ? "Margin (assumed)" : "Margin"} value={pct(result.economics.margin_pct)} />
                  <Econ label="Extra profit" value={inr(result.economics.incremental_profit, 1)} accent />
                </dl>
              )}
            </Panel>
          )}

          {result && (
            <Panel title="Raw request and response">
              <details className="group">
                <summary className="cursor-pointer text-[14px] text-muted hover:text-text">Show the JSON and the copy prompt</summary>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <Code title="Request" value={scenario} />
                  <Code title="Response" value={{ ...result, trace: { ...result.trace, prompt: undefined } }} />
                </div>
                {result.trace.prompt && (
                  <div className="mt-4">
                    <p className="mb-2 text-[13px] text-muted">Prompt the copy writer gets. The engine has already fixed every number in it.</p>
                    <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-[14px] bg-bg/60 p-4 font-mono text-[12.5px] leading-relaxed">{result.trace.prompt}</pre>
                  </div>
                )}
              </details>
            </Panel>
          )}
        </div>

        {/* Phone */}
        <div className="order-2 lg:order-none lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4 xl:self-start">
          {sent && (
            <div className="mb-4 flex justify-center">
              <div role="tablist" aria-label="Phone view" className="flex gap-1 rounded-full bg-surface-2 p-1">
                {(["lock", "offer"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    type="button"
                    aria-selected={screen === v}
                    onClick={() => setScreen(v)}
                    className={`rounded-full px-4 py-1.5 text-[13.5px] ${screen === v ? "bg-bg font-semibold" : "text-muted"}`}
                  >
                    {v === "lock" ? "Notification" : "Offer"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Phone time={`${String(Math.floor(controls.minutes / 60)).padStart(2, "0")}:${String(controls.minutes % 60).padStart(2, "0")}`}>
            {sent && screen === "offer" && result?.offer && result.ui_configuration ? (
              <OfferScreen offer={result.offer} notification={result.notification} component={result.ui_configuration.component} userName={scenario.user.name} />
            ) : (
              <LockScreen
                time={`${String(Math.floor(controls.minutes / 60)).padStart(2, "0")}:${String(controls.minutes % 60).padStart(2, "0")}`}
                dateLabel={`${dayName}, ${new Date(`${controls.date}T00:00:00Z`).getUTCDate()} October`}
                notification={sent ? result?.notification : undefined}
                emptyNote={result && !sent ? `Nothing sent. ${firstSentence(result.reason)}` : undefined}
              />
            )}
          </Phone>
          {sent && result?.notification && (
            <p className="mt-4 text-center text-[13px] text-muted">
              {result.notification.source === "claude" ? "Written by Claude" : "Template copy"}
              {result.notification.grounded ? ", every number checked" : ", failed the number check"}
              {result.notification.fallback_reason ? ` (Claude skipped: ${result.notification.fallback_reason})` : ""}
            </p>
          )}
          {result && !sent && result.trace.gates.length > 0 && (
            <ul className="mx-auto mt-4 max-w-[300px] space-y-1 text-[13px] text-muted">
              {result.trace.gates
                .filter((g) => !g.passed)
                .slice(0, 3)
                .map((g) => {
                  const f = g.checks.find((c) => !c.ok)!;
                  return (
                    <li key={g.merchant_id}>
                      {g.merchant_name}: {shortFail(f.rule, f.detail)}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function firstSentence(s: string) {
  const i = s.indexOf(". ");
  return i > 0 ? s.slice(0, i + 1) : s;
}

function Meter({ v }: { v: number }) {
  return (
    <span className="flex items-center gap-2" title={pct(v)}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-text/70" style={{ width: `${Math.round(v * 100)}%` }} />
      </span>
      <span className="text-[12.5px] text-muted">{Math.round(v * 100)}</span>
    </span>
  );
}

function Econ({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[22px] font-semibold tracking-tight ${accent ? "text-accent-text" : ""}`}>{value}</dd>
    </div>
  );
}

function Code({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[13px] text-muted">{title}</p>
      <pre className="max-h-[360px] overflow-auto rounded-[14px] bg-bg/60 p-4 font-mono text-[12px] leading-relaxed">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function TierChart({ tiers, chosen, max }: { tiers: Tier[]; chosen?: number; max?: number }) {
  const W = 640;
  const H = 220;
  const pad = { l: 8, r: 8, t: 26, b: 44 };
  const vals = tiers.map((t) => t.incremental);
  const hi = Math.max(1, ...vals);
  const lo = Math.min(0, ...vals);
  const span = hi - lo;
  const y = (v: number) => pad.t + ((hi - v) / span) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / tiers.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={tiers.map((t) => `${t.pct}%: ${inr(t.incremental, 1)}`).join(", ")}>
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" />
      {tiers.map((t, i) => {
        const x = pad.l + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const top = Math.min(y(0), y(t.incremental));
        const h = Math.max(2, Math.abs(y(t.incremental) - y(0)));
        const isChosen = t.pct === chosen;
        const fill = !t.affordable || t.unit_profit <= 0 ? "var(--line-strong)" : t.incremental < 0 ? "var(--bad)" : isChosen ? "var(--accent)" : "var(--muted)";
        return (
          <g key={t.pct}>
            <motion.rect
              x={x}
              width={w}
              rx="6"
              fill={fill}
              opacity={isChosen ? 1 : 0.55}
              initial={false}
              animate={{ y: top, height: h }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
            <text x={x + w / 2} y={(t.incremental >= 0 ? top : top + h) + (t.incremental >= 0 ? -8 : 16)} textAnchor="middle" fontSize="13" fontWeight={isChosen ? 700 : 500} fill={isChosen ? "var(--accent-text)" : "var(--text)"}>
              {inr(t.incremental, 1)}
            </text>
            <text x={x + w / 2} y={H - 22} textAnchor="middle" fontSize="13" fill="var(--text)" fontWeight={isChosen ? 700 : 400}>
              {t.pct}%
            </text>
            <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill="var(--muted)">
              {!t.affordable ? "over budget" : t.pct === max ? "owner's max" : `${Math.round(t.p_convert * 100)}% buy`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
