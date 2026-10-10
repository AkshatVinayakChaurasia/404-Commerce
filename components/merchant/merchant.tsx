"use client";

// Live merchant dashboard on the official dataset. Polls /api/live/merchant every
// 2 s: the engine's decisions for people passing the shop, real claims from the
// customer app, the counter (redeem a code) and the owner's rules.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Chip, Panel, Segmented, Slider, Toggle } from "@/components/ui";
import { FoodGlyph } from "@/components/food-glyph";
import { inr } from "@/lib/format";
import { ClockChip, ModeToggle, LANG_NAME, Stat, StoreNote, hourLabel, startPolling, type ClockMode, type LiveMoment, type Poller } from "@/components/live/shared";
import { useRealtime } from "@/components/live/realtime";
import { useViewer } from "@/components/auth/use-viewer";
import { EngineView } from "@/components/lab/engine-view";
import type { SolveResult } from "@/lib/engine/types";

export type MerchantOption = { id: string; name: string; category: string; locality: string };

type Rules = {
  max_discount_pct: number;
  min_margin_pct: number;
  promo_start_hour: number | null;
  promo_end_hour: number | null;
  weekdays_only: boolean;
  paused: boolean;
};

type FeedEvent = {
  tick: number;
  time: string;
  customer: { id: string; name: string; language: string };
  distance_m: number;
  action: "send" | "skip";
  reason: string;
  offer: { item_name: string; discount_pct: number; final_price_inr: number; base_price_inr: number } | null;
  notification: { title: string; body: string; language: string } | null;
  outcome: "redeemed" | "claimed" | "ignored" | "skipped";
  incremental: boolean;
  profit_estimate_inr: number | null;
  realized_profit_inr: number;
};

type Claim = {
  id: string;
  code: string;
  created_at: string;
  customer_name: string;
  item_name: string;
  discount_pct: number;
  final_price_inr: number;
  base_price_inr: number;
  unit_cost_inr: number;
  status: "claimed" | "redeemed";
  redeemed_at: string | null;
  valid_until: string;
};

type Live = {
  store: "supabase" | "memory";
  store_error: string | null;
  merchant: { id: string; name: string; category: string; locality: string; objective: string };
  moment: LiveMoment;
  rules: Rules;
  overridden: boolean;
  access: { owned: boolean; yours: boolean };
  events: FeedEvent[];
  summary: {
    moments: number;
    sent: number;
    skipped: number;
    claimed: number;
    redeemed: number;
    incremental: number;
    realized_profit_inr: number;
    avg_discount_pct: number;
    skip_reasons: { reason: string; count: number }[];
  };
  claims: Claim[];
};

type Explained = {
  moment: string;
  person: { name: string; language: string; distance_m: number };
  response: { action: "send" | "skip"; reason: string };
  engine: SolveResult | null;
};

const DEFAULT_MERCHANT = "m_l_MER-009";
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function MerchantDashboard({ merchants }: { merchants: MerchantOption[] }) {
  const [id, setId] = useState(merchants.some((m) => m.id === DEFAULT_MERCHANT) ? DEFAULT_MERCHANT : merchants[0]?.id);
  const [mode, setMode] = useState<ClockMode>("live");
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [counterMsg, setCounterMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const reduce = useReducedMotion();
  const { me } = useViewer();
  // A signed-in shop owner lands on their own shop; they can still browse others.
  const myShop = me?.profile?.role === "merchant" ? me.profile.merchant_id : null;
  const [browsing, setBrowsing] = useState(false);
  const poller = useRef<Poller | null>(null);
  const [explain, setExplain] = useState<{ tick: number; data: Explained | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!myShop || browsing) return;
    /* eslint-disable react-hooks/set-state-in-effect -- switch to the owner's shop once their profile loads */
    setId(myShop);
    setLive(null);
    setDraft(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [myShop, browsing]);

  useEffect(() => {
    const p = startPolling(
      () => `/api/live/merchant?id=${encodeURIComponent(id)}&mode=${mode}`,
      2000,
      (d) => {
        const next = d as Live;
        setLive(next);
        setError(null);
        // Keep the owner's unsaved edits; only seed the form when it is empty.
        setDraft((cur) => cur ?? next.rules);
      },
      setError,
    );
    poller.current = p;
    return p;
  }, [id, mode]);

  // The owner hears about new claims and redemptions the instant they happen.
  const realtime = useRealtime("claims", live?.access?.yours ? `merchant_id=eq.${id}` : null, () => poller.current?.refresh());
  const locked = Boolean(live?.access?.owned && !live.access.yours);

  async function openExplain(tick: number) {
    setExplain({ tick, data: null, error: null });
    try {
      const res = await fetch(`/api/live/explain?id=${encodeURIComponent(id)}&tick=${tick}&mode=${mode}`);
      const data = await res.json();
      setExplain({ tick, data: res.ok ? (data as Explained) : null, error: res.ok ? null : (data.error ?? "Couldn't load this decision") });
    } catch {
      setExplain({ tick, data: null, error: "Couldn't reach the server." });
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter((m) => !q || `${m.name} ${m.category} ${m.locality}`.toLowerCase().includes(q));
  }, [merchants, query]);

  function choose(next: string) {
    setId(next);
    setLive(null);
    setDraft(null);
    setCounterMsg(null);
  }

  async function saveRules(reset = false) {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/live/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reset ? { merchant_id: id, reset: true } : { merchant_id: id, rules: draft }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Couldn't save the rules");
      else setDraft(data.rules);
    } catch {
      setError("Couldn't reach the server to save the rules. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function redeem(c: string) {
    setCounterMsg(null);
    try {
      const res = await fetch("/api/claims/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchant_id: id, code: c }),
      });
      const data = await res.json();
      if (!res.ok) setCounterMsg({ tone: "bad", text: data.error ?? "Couldn't redeem" });
      else {
        setCounterMsg({ tone: "ok", text: `Redeemed ${data.claim.code}: ${data.claim.item_name} for ${inr(data.claim.final_price_inr)}${data.warning ? `. ${data.warning}.` : "."}` });
        setCode("");
      }
    } catch {
      setCounterMsg({ tone: "bad", text: "Couldn't reach the server. Try again." });
    }
  }

  const s = live?.summary;
  const dirty = Boolean(draft && live && JSON.stringify(draft) !== JSON.stringify(live.rules));
  const realRedeemed = (live?.claims ?? []).filter((c) => c.status === "redeemed");
  const realProfit = realRedeemed.reduce((a, c) => a + (c.final_price_inr - c.unit_cost_inr), 0);
  const allDay = draft ? draft.promo_start_hour === null || (draft.promo_start_hour === 0 && draft.promo_end_hour === 24) : true;

  return (
    <div className="mx-auto grid max-w-[1360px] gap-6 px-4 pb-24 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="order-2 lg:sticky lg:top-4 lg:order-none lg:self-start">
        {myShop && !browsing ? (
          <Panel title="Your shop">
            <p className="text-[15px] font-semibold">{me?.shop?.name}</p>
            <p className="text-[13px] capitalize text-muted">
              {me?.shop?.category}, {me?.shop?.locality}
            </p>
            <p className="mt-3 text-[12.5px] text-muted">
              {realtime ? "Live: claims and redemptions appear the moment they happen." : "Updates every 2 seconds."}
            </p>
            <button type="button" onClick={() => setBrowsing(true)} className="mt-4 w-full rounded-full border border-line-strong px-4 py-2 text-[13.5px] hover:bg-surface-2">
              Browse other shops
            </button>
          </Panel>
        ) : (
        <Panel title="Merchants" aside={`${merchants.length} in Bengaluru`}>
          <input
            type="search"
            aria-label="Search merchants"
            placeholder="Search name, type or area"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 text-[14px] placeholder:text-muted"
          />
          <ul className="-mx-2 mt-3 max-h-[42vh] overflow-y-auto lg:max-h-[64vh]">
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => choose(m.id)}
                  aria-current={m.id === id ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left ${m.id === id ? "bg-accent-tint" : "hover:bg-surface-2"}`}
                >
                  <FoodGlyph category={m.category} size={22} className="shrink-0 text-muted" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{m.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {m.category}, {m.locality}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2 py-3 text-[13.5px] text-muted">No merchant matches “{query}”.</li>}
          </ul>
          {myShop && (
            <button type="button" onClick={() => setBrowsing(false)} className="mt-3 w-full rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent">
              Back to my shop
            </button>
          )}
        </Panel>
        )}
      </aside>

      <div className="order-1 min-w-0 space-y-6 lg:order-none">
        {!myShop && me?.login && (
          <p className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-[14px] text-muted">
            Demo mode: any unclaimed shop can be explored and edited.{" "}
            <Link href={me.user ? "/onboarding?as=merchant" : "/login"} className="font-semibold text-text underline underline-offset-2">
              {me.user ? "Claim your shop" : "Sign in as a shop owner"}
            </Link>{" "}
            to run your own dashboard.
          </p>
        )}
        {locked && (
          <p className="rounded-[var(--radius-control)] bg-accent-tint px-4 py-3 text-[14px] text-accent-text">
            This shop is run by its owner. You can watch its decisions; only the owner can change its rules or redeem its codes.
          </p>
        )}
        <div className="flex flex-col gap-4 pt-1 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="title text-[clamp(28px,3.4vw,42px)]">{live?.merchant.name ?? merchants.find((m) => m.id === id)?.name}</h1>
            {live && (
              <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted">
                {live.merchant.category.charAt(0).toUpperCase() + live.merchant.category.slice(1)} in {live.merchant.locality}. {live.merchant.objective}.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ClockChip moment={live?.moment ?? null} mode={mode} />
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>

        {error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{error}</p>}

        <section aria-label="Last 120 moments" className="grid overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-3 xl:grid-cols-6" style={{ gap: 1 }}>
          <Stat label="People passing" value={s ? s.moments : "—"} note="last 120 moments" />
          <Stat label="Offers sent" value={s ? s.sent : "—"} note={s ? `${s.skipped} skipped, avg ${s.avg_discount_pct}% off` : ""} />
          <Stat label="Claimed" value={s ? s.claimed : "—"} note={s && s.sent ? `${Math.round((s.claimed / s.sent) * 100)}% of offers` : ""} />
          <Stat label="Redeemed" value={s ? s.redeemed : "—"} note={s ? `${s.incremental} came because of it` : ""} />
          <Stat label="Profit, simulated" value={s ? inr(s.realized_profit_inr) : "—"} note="margin minus send cost" tone="accent" />
          <Stat label="Profit, real claims" value={live ? inr(Math.round(realProfit)) : "—"} note={live ? `${realRedeemed.length} redeemed at your counter` : ""} tone="ok" />
        </section>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <Panel title="Live decisions" aside="A new moment every 4 seconds">
            <p className="-mt-2 mb-3 text-[12.5px] text-muted">
              Customer profiles and weather come from the dataset. Where each person stands, and whether they come in, are simulated.
            </p>
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {(live?.events ?? []).slice(0, 14).map((e) => (
                  <motion.li
                    key={e.tick}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-[66px_minmax(0,1fr)_auto] items-start gap-3 py-2.5"
                  >
                    <span className="pt-0.5 text-[12.5px] text-muted">{e.time.split(" ").slice(1).join(" ")}</span>
                    <span className="min-w-0">
                      <span className="block text-[14px]">
                        <span className="font-semibold">{e.customer.name}</span>
                        <span className="text-muted">
                          , {e.distance_m} m away, {LANG_NAME[e.customer.language] ?? e.customer.language}
                        </span>
                      </span>
                      <span className="block truncate text-[13px] text-muted">
                        {e.action === "send" && e.offer
                          ? `${e.offer.discount_pct ? `${e.offer.discount_pct}% off ` : "Full price: "}${e.offer.item_name} for ${inr(e.offer.final_price_inr)}`
                          : e.reason}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      {e.action === "skip" ? (
                        <Chip tone="muted">Skipped</Chip>
                      ) : e.outcome === "redeemed" ? (
                        <Chip tone="ok">{e.incremental ? "Came because of it" : "Redeemed"}</Chip>
                      ) : e.outcome === "claimed" ? (
                        <Chip tone="accent">Claimed</Chip>
                      ) : (
                        <Chip tone="muted">Ignored</Chip>
                      )}
                      {e.action === "send" && (
                        <span className={`text-[12.5px] font-semibold ${e.realized_profit_inr < 0 ? "text-bad" : ""}`}>{inr(e.realized_profit_inr, 1)}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => openExplain(e.tick)}
                        className="text-[12.5px] font-medium text-accent-text underline-offset-2 hover:underline"
                        aria-label={`Why this decision for ${e.customer.name} at ${e.time}`}
                      >
                        Why?
                      </button>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {!live && !error && <p className="py-6 text-center text-[14px] text-muted">Starting the live feed…</p>}
            {s && s.skip_reasons.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[13px] text-muted">Why offers were skipped</p>
                <ul className="mt-2 space-y-1.5">
                  {s.skip_reasons.map((r) => (
                    <li key={r.reason} className="flex justify-between gap-4 text-[13.5px]">
                      <span className="min-w-0 truncate">{r.reason}</span>
                      <span className="font-semibold">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Counter" aside="Real claims from the customer app">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  redeem(code);
                }}
                className="flex gap-2"
              >
                <input
                  aria-label="Claim code"
                  placeholder="AX-7K2QD"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 font-mono text-[15px] tracking-wider"
                />
                <button type="submit" disabled={!code.trim() || locked} className="rounded-[var(--radius-control)] bg-text px-4 text-[14px] font-semibold text-bg disabled:opacity-40">
                  Redeem
                </button>
              </form>
              {counterMsg && <p className={`mt-2 text-[13.5px] ${counterMsg.tone === "ok" ? "text-ok" : "text-bad"}`}>{counterMsg.text}</p>}
              <ul className="mt-4 divide-y divide-line">
                {(live?.claims ?? []).slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">
                        <span className="font-mono font-semibold">{c.code}</span> {c.customer_name.split(" ")[0]}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {c.discount_pct ? `${c.discount_pct}% off ` : ""}
                        {c.item_name}, {inr(c.final_price_inr)}, claimed {timeOf(c.created_at)}
                      </span>
                    </span>
                    {c.status === "redeemed" ? (
                      <Chip tone="ok">Redeemed</Chip>
                    ) : (
                      <button type="button" onClick={() => redeem(c.code)} className="rounded-full border border-line-strong px-3 py-1 text-[13px] font-medium hover:bg-surface-2">
                        Redeem
                      </button>
                    )}
                  </li>
                ))}
                {live && live.claims.length === 0 && (
                  <li className="py-3 text-[13.5px] text-muted">
                    No claims yet. Open the Customer page, pick someone in {live.merchant.locality}, and claim an offer from this shop.
                  </li>
                )}
              </ul>
              <div className="mt-3">
                <StoreNote store={live?.store ?? null} error={live?.store_error} />
              </div>
            </Panel>

            <Panel title="Offer rules" aside={live?.overridden ? "Your rules" : "From the dataset"}>
              {draft && (
                <div className="divide-y divide-line">
                  <Toggle label="Pause all offers" checked={draft.paused} onChange={(v) => setDraft({ ...draft, paused: v })} />
                  <Slider label="Maximum discount" value={draft.max_discount_pct} min={0} max={50} step={5} onChange={(v) => setDraft({ ...draft, max_discount_pct: v })} format={(v) => `${v}%`} />
                  <Slider label="Minimum margin" value={draft.min_margin_pct} min={0} max={60} step={1} onChange={(v) => setDraft({ ...draft, min_margin_pct: v })} format={(v) => `${v}%`} />
                  <Segmented
                    label="Promotion window"
                    value={allDay ? "all" : "window"}
                    options={[
                      { value: "all", label: "Whenever open" },
                      { value: "window", label: "Set hours" },
                    ]}
                    onChange={(v) => setDraft({ ...draft, promo_start_hour: v === "all" ? 0 : 13, promo_end_hour: v === "all" ? 24 : 15 })}
                  />
                  {!allDay && draft.promo_start_hour !== null && draft.promo_end_hour !== null && (
                    <>
                      <Slider label="Offers start" value={draft.promo_start_hour} min={6} max={draft.promo_end_hour - 1} step={1} onChange={(v) => setDraft({ ...draft, promo_start_hour: v })} format={hourLabel} />
                      <Slider label="Offers stop" value={draft.promo_end_hour} min={draft.promo_start_hour + 1} max={24} step={1} onChange={(v) => setDraft({ ...draft, promo_end_hour: v })} format={hourLabel} />
                    </>
                  )}
                  <Toggle label="Weekdays only" checked={draft.weekdays_only} onChange={(v) => setDraft({ ...draft, weekdays_only: v })} />
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => saveRules(false)}
                  disabled={!dirty || saving || locked}
                  className="flex-1 rounded-[var(--radius-control)] bg-text py-2.5 text-[14px] font-semibold text-bg disabled:opacity-40"
                >
                  {saving ? "Saving…" : dirty ? "Save rules" : "Rules saved"}
                </button>
                {live?.overridden && (
                  <button type="button" onClick={() => saveRules(true)} disabled={saving} className="rounded-[var(--radius-control)] border border-line-strong px-3 text-[14px]">
                    Use dataset rules
                  </button>
                )}
              </div>
              <p className="mt-3 text-[12.5px] text-muted">
                Saved rules change the live feed and the customer app within seconds. The organizers&apos; endpoint, POST /decide, always uses the dataset&apos;s rules.
              </p>
            </Panel>
          </div>
        </div>
      </div>
      {explain && <ExplainDialog explain={explain} onClose={() => setExplain(null)} />}
    </div>
  );
}

/** The Decision Lab for one moment of the feed: every rule, score and tier. */
function ExplainDialog({ explain, onClose }: { explain: { tick: number; data: Explained | null; error: string | null }; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const d = explain.data;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Why this decision" className="h-full w-full max-w-[860px] overflow-y-auto bg-bg p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="title text-[24px]">Why this decision</h2>
            {d && (
              <p className="mt-1 text-[14px] text-muted">
                {d.person.name}, {d.person.distance_m} m away, {LANG_NAME[d.person.language] ?? d.person.language}, {d.moment}
              </p>
            )}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-[18px] hover:bg-surface">
            ×
          </button>
        </div>
        {explain.error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{explain.error}</p>}
        {!d && !explain.error && <p className="py-10 text-center text-muted">Re-running the engine for this moment…</p>}
        {d?.engine && (
          <div className="space-y-5">
            <EngineView result={d.engine} runs={explain.tick} context={d.moment} request={{ tick: explain.tick }} />
          </div>
        )}
      </div>
    </div>
  );
}
