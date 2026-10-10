"use client";

// Shared rendering of one engine run: verdict, pipeline, rules, scores,
// discount tiers, raw JSON, and the phone. Used by the playground and the
// official-dataset mode of the Decision Lab.

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SolveResult, Tier } from "@/lib/engine/types";
import { Chip, Panel } from "@/components/ui";
import { LockScreen, OfferScreen, Phone } from "@/components/phone";
import { inr, pct, shortFail } from "@/lib/format";
import { SEND_COST } from "@/lib/engine/model";

export function EngineView({
  result,
  runs,
  context,
  request,
  response,
  maxPct,
  extra,
}: {
  result: SolveResult | null;
  runs: number;
  context: string;
  request: unknown;
  response?: unknown;
  maxPct?: number;
  extra?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const sent = result?.action === "send";
  const chosenKey = result?.trace.chosen ? `${result.trace.chosen.merchant_id}/${result.trace.chosen.item_id}` : "";
  const topCandidate = result?.trace.candidates[0];
  return (
    <>
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
                  {context}, answered in {result.latency_ms} ms
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
          <TierChart tiers={result.trace.tiers} chosen={result.trace.chosen?.pct} max={maxPct} />
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
              <Code title="Request" value={request} />
              <Code title="Response" value={response ?? { ...result, trace: { ...result.trace, prompt: undefined } }} />
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
      {extra}
    </>
  );
}

export function PhoneView({ result, time, dateLabel, userName }: { result: SolveResult | null; time: string; dateLabel: string; userName: string }) {
  const [screen, setScreen] = useState<"lock" | "offer">("lock");
  const sent = result?.action === "send";
  return (
    <div>
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
          <Phone time={time}>
            {sent && screen === "offer" && result?.offer && result.ui_configuration ? (
              <OfferScreen offer={result.offer} notification={result.notification} component={result.ui_configuration.component} userName={userName} />
            ) : (
              <LockScreen
                time={time}
                dateLabel={dateLabel}
                notification={sent ? result?.notification : undefined}
                emptyNote={result && !sent ? `Nothing sent. ${firstSentence(result.reason)}` : undefined}
              />
            )}
          </Phone>
          {sent && result?.notification && (
            <p className="mt-4 text-center text-[13px] text-muted">
              {result.notification.source === "claude" ? "Written by the language model" : "Template copy"}
              {result.notification.grounded ? ", every number checked" : ", failed the number check"}
              {result.notification.fallback_reason ? ` (model skipped: ${result.notification.fallback_reason})` : ""}
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
