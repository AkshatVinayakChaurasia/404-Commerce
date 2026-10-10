"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MERCHANTS } from "@/lib/data/koramangala";
import type { SimResult } from "@/lib/engine/simulate";
import type { OfferWindow } from "@/lib/engine/types";
import { ProfitChart } from "@/components/profit-chart";
import { Chip, Panel, Segmented, Slider } from "@/components/ui";
import { FoodGlyph } from "@/components/food-glyph";
import { inr } from "@/lib/format";

const FOCUS = "brew-bites";
const merchant = MERCHANTS.find((m) => m.id === FOCUS)!;
const defaultWindow = merchant.offer_windows?.[0];

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const label12 = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}${m % 60 ? `:${String(m % 60).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

type Rules = { max: number; start: number; end: number; days: "weekdays" | "all" };
const initialRules: Rules = {
  max: merchant.max_discount_pct,
  start: toMin(defaultWindow?.start ?? "13:00"),
  end: toMin(defaultWindow?.end ?? "15:00"),
  days: defaultWindow && defaultWindow.days.length === 7 ? "all" : "weekdays",
};

export function MerchantDashboard() {
  const [rules, setRules] = useState<Rules>(initialRules);
  const [applied, setApplied] = useState<Rules>(initialRules);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [prev, setPrev] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const reduce = useReducedMotion();
  const current = useRef<SimResult | null>(null);

  // Callers set busy before calling; the effect's first run starts busy already.
  const run = useCallback(async (r: Rules, keepPrev: boolean) => {
    const window: OfferWindow = {
      days: r.days === "all" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
      start: toHhmm(r.start),
      end: toHhmm(r.end),
      goal: defaultWindow?.goal,
    };
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ n: 600, seed: 7, focus: FOCUS, overrides: { [FOCUS]: { max_discount_pct: r.max, offer_windows: [window] } } }),
      });
      const next: SimResult = await res.json();
      if (keepPrev) setPrev(current.current);
      current.current = next;
      setSim(next);
      setApplied(r);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    run(initialRules, false);
  }, [run]);

  const f = sim?.focus;
  const dirty = JSON.stringify(rules) !== JSON.stringify(applied);
  const hours = f?.by_hour ?? [];
  const maxSent = Math.max(1, ...hours.map((h) => h.sent));

  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 px-4 pb-24 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-on-accent">
            <FoodGlyph category="coffee" size={30} />
          </span>
          <div>
            <p className="title text-[17px]">{merchant.name}</p>
            <p className="text-[13px] text-muted">Café, Koramangala</p>
          </div>
        </div>
        <nav aria-label="Dashboard sections" className="mt-4 hidden flex-col gap-1 lg:flex">
          {[
            ["#overview", "Overview"],
            ["#rules", "Offer rules"],
            ["#offers", "Recent offers"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-[10px] px-3 py-2 text-[15px] text-muted hover:bg-surface hover:text-text">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-6">
        <div id="overview" className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="title text-[clamp(30px,3.6vw,44px)]">Your week with AscenDex</h1>
            <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
              {sim ? `${sim.n} simulated moments near your café, Monday to Sunday.` : "Running the week…"} Profit here means
              extra profit compared with sending no offers at all.
            </p>
          </div>
          <Chip tone="muted">Simulated, not real sales</Chip>
        </div>

        {error && (
          <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">
            Couldn&apos;t reach /api/simulate. Check the dev server is running, then press “Run the week again”.
          </p>
        )}

        <section className="grid overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 xl:grid-cols-4" style={{ gap: 1 }}>
          <Kpi label="Offers sent" value={f ? String(f.sent) : "—"} sub={f ? `average ${f.avg_pct}% off` : ""} prev={prev?.focus.sent} cur={f?.sent} />
          <Kpi label="Redeemed" value={f ? String(f.redeemed) : "—"} sub={f && f.sent ? `${Math.round((f.redeemed / f.sent) * 100)}% of offers` : ""} prev={prev?.focus.redeemed} cur={f?.redeemed} />
          <Kpi
            label="Came because of the offer"
            value={f ? String(f.incremental_buyers) : "—"}
            sub={f ? `${f.subsidised_buyers} would have come anyway` : ""}
            prev={prev?.focus.incremental_buyers}
            cur={f?.incremental_buyers}
          />
          <Kpi label="Extra profit" value={f ? inr(f.profit) : "—"} sub={f ? `${inr(f.discount_given)} given in discounts` : ""} prev={prev?.focus.profit} cur={f?.profit} money accent />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Panel title="Extra profit through the week" aside="vs. max discount to every good match">
            {f ? (
              <ProfitChart
                x={f.series.map((p) => p.i)}
                xLabel="Moments simulated"
                height={250}
                series={[
                  { key: "engine", label: "AscenDex", color: "var(--accent-text)", values: f.series.map((p) => p.engine) },
                  { key: "max", label: `Max ${applied.max}% to all`, color: "var(--muted)", dash: "6 6", values: f.series.map((p) => p.max_discount) },
                ]}
              />
            ) : (
              <div className="h-[220px]" />
            )}
          </Panel>

          <Panel title="When offers went out" aside={`${label12(applied.start)} to ${label12(applied.end)} window`}>
            <div className="flex h-[200px] items-end gap-1.5" role="img" aria-label={hours.map((h) => `${label12(h.hour * 60)}: ${h.sent} sent, ${h.redeemed} redeemed`).join("; ")}>
              {hours.map((h) => (
                <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    <motion.div
                      className="w-full max-w-[26px] rounded-t-[6px] bg-surface-2"
                      initial={false}
                      animate={{ height: `${(h.sent / maxSent) * 100}%` }}
                      transition={{ duration: reduce ? 0 : 0.4 }}
                    >
                      <motion.div
                        className="h-full w-full rounded-t-[6px] bg-accent"
                        initial={false}
                        animate={{ scaleY: h.sent ? h.redeemed / h.sent : 0 }}
                        style={{ transformOrigin: "bottom" }}
                        transition={{ duration: reduce ? 0 : 0.4 }}
                      />
                    </motion.div>
                  </div>
                  <span className="text-[11px] text-muted">{h.hour % 12 === 0 ? 12 : h.hour % 12}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex gap-4 text-[12.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" /> Redeemed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-surface-2" aria-hidden="true" /> Sent, not redeemed
              </span>
            </p>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Panel title="Offer rules" className="scroll-mt-4" aside="AscenDex never goes past these">
            <div id="rules" className="divide-y divide-line">
              <Slider label="Maximum discount" value={rules.max} min={0} max={40} step={5} onChange={(v) => setRules((r) => ({ ...r, max: v }))} format={(v) => `${v}%`} />
              <Slider
                label="Offers start"
                value={rules.start}
                min={8 * 60}
                max={rules.end - 30}
                step={30}
                onChange={(v) => setRules((r) => ({ ...r, start: v }))}
                format={label12}
              />
              <Slider
                label="Offers stop"
                value={rules.end}
                min={rules.start + 30}
                max={23 * 60}
                step={30}
                onChange={(v) => setRules((r) => ({ ...r, end: v }))}
                format={label12}
              />
              <Segmented
                label="Days"
                value={rules.days}
                options={[
                  { value: "weekdays", label: "Weekdays" },
                  { value: "all", label: "Every day" },
                ]}
                onChange={(v) => setRules((r) => ({ ...r, days: v }))}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                run(rules, true);
              }}
              disabled={busy || !dirty}
              className="mt-4 w-full rounded-[var(--radius-control)] bg-[var(--ink)] py-3 text-[15px] font-semibold text-[var(--foam)] transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? "Running the week…" : dirty ? "Run the week again" : "Change a rule to compare"}
            </button>
            {prev && f && (
              <p className="mt-3 text-[13.5px] text-muted">
                Last run: {inr(prev.focus.profit)} extra profit from {prev.focus.sent} offers. Now {inr(f.profit)} from {f.sent}.
              </p>
            )}
          </Panel>

          <Panel title="Recent offers" aside="Who came because of the offer">
            <div id="offers" className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[520px] text-left text-[14px]">
                <thead className="whitespace-nowrap text-[12.5px] text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Person</th>
                    <th className="py-2 pr-3 font-medium">Offer</th>
                    <th className="py-2 pr-3 font-medium">Outcome</th>
                    <th className="py-2 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(f?.log ?? []).map((r) => (
                    <tr key={r.i} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap py-2.5 pr-3 text-muted">{r.time}</td>
                      <td className="py-2.5 pr-3">{r.user}</td>
                      <td className="py-2.5 pr-3">
                        {r.pct}% off {r.item}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.outcome === "incremental" ? (
                          <Chip tone="ok">Came because of it</Chip>
                        ) : r.outcome === "subsidised" ? (
                          <Chip tone="accent">Would have come anyway</Chip>
                        ) : (
                          <Chip tone="muted">Didn&apos;t come</Chip>
                        )}
                      </td>
                      <td className={`whitespace-nowrap py-2.5 text-right font-semibold ${r.profit < 0 ? "text-bad" : ""}`}>{inr(r.profit, 1)}</td>
                    </tr>
                  ))}
                  {f && f.log.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted">
                        No offers went out with these rules. Widen the window or raise the maximum discount.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <p className="max-w-[80ch] text-[13px] text-muted">
          Every figure on this page comes from running the engine against synthetic people and our own response model,
          which adds per-person noise the engine can&apos;t see. It is not the hackathon&apos;s hidden simulator.
          {sim && f ? ` The same week with a flat ${applied.max}% to every good match would have earned ${inr(f.max_discount_profit)} from ${f.max_discount_sent} offers.` : ""}
        </p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  prev,
  cur,
  money,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  prev?: number;
  cur?: number;
  money?: boolean;
  accent?: boolean;
}) {
  const delta = prev !== undefined && cur !== undefined ? cur - prev : null;
  return (
    <div className="bg-surface p-5">
      <p className="text-[13.5px] text-muted">{label}</p>
      <p className={`mt-1 text-[32px] font-semibold tracking-tight ${accent ? "text-accent-text" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[13px] text-muted">
        {sub}
        {delta !== null && delta !== 0 && (
          <span className={`ml-2 font-semibold ${delta > 0 ? "text-ok" : "text-bad"}`}>
            {delta > 0 ? "+" : "−"}
            {money ? inr(Math.abs(delta)) : Math.abs(delta)} vs last run
          </span>
        )}
      </p>
    </div>
  );
}
