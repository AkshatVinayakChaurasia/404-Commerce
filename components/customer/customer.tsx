"use client";

// Customer app on the official dataset. Pick any of the 350 customers: from their
// real location, every merchant within a short walk is decided right now. Claim an
// offer to get a code; the merchant dashboard sees it within seconds, and when the
// counter redeems it, this phone updates too.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Chip, Panel, Slider } from "@/components/ui";
import { Phone } from "@/components/phone";
import { FoodGlyph } from "@/components/food-glyph";
import { LogoMark } from "@/components/logo";
import { inr } from "@/lib/format";
import { ClockChip, LANG_NAME, ModeToggle, StoreNote, startPolling, type ClockMode, type LiveMoment, type Poller } from "@/components/live/shared";
import { useRealtime } from "@/components/live/realtime";
import { useViewer } from "@/components/auth/use-viewer";

export type CustomerOption = { id: string; name: string; locality: string; language: string; nearby: number };

type Nearby = {
  merchant: { id: string; name: string; category: string; locality: string };
  distance_m: number;
  item_name: string | null;
  base_price_inr: number | null;
  response: {
    action: "send" | "skip";
    reason: string;
    offer: { merchant_id: string; discount_pct: number; item_id: string; final_price_inr: number; valid_minutes: number } | null;
    notification: { title: string; body: string; language: string; cta: string } | null;
    ui_hints: { walk_minutes: number | null; weather_note: string };
    profit_estimate_inr: number | null;
  };
};

type Claim = {
  id: string;
  code: string;
  created_at: string;
  merchant_id: string;
  merchant_name: string;
  item_name: string;
  discount_pct: number;
  final_price_inr: number;
  base_price_inr: number;
  status: "claimed" | "redeemed";
  redeemed_at: string | null;
  valid_until: string;
};

type Live = {
  store: "supabase" | "memory";
  store_error: string | null;
  customer: { id: string; name: string; language: string; locality: string; marketing_consent: boolean; declared_preferences: string[] };
  moment: LiveMoment;
  radius_m: number;
  minutes_available: number;
  nearby: Nearby[];
  claims: Claim[];
};

const DEFAULT_CUSTOMER = "c_001";
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function CustomerApp({ customers }: { customers: CustomerOption[] }) {
  const [id, setId] = useState(customers.some((c) => c.id === DEFAULT_CUSTOMER) ? DEFAULT_CUSTOMER : customers[0]?.id);
  const [mode, setMode] = useState<ClockMode>("live");
  const [minutes, setMinutes] = useState(30);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<"lock" | "offers" | "code">("lock");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const { me, ready } = useViewer();
  // A signed-in customer with a finished profile sees their own offers; anyone can
  // switch to the demo customers (judges, curious visitors).
  const mine = me?.profile?.role === "customer" && Boolean(me.profile.locality);
  const [demo, setDemo] = useState(false);
  const asMe = mine && !demo;
  const poller = useRef<Poller | null>(null);

  useEffect(() => {
    if (!ready) return;
    const p = startPolling(
      () =>
        asMe
          ? `/api/live/customer?me=1&mode=${mode}&minutes=${minutes}`
          : `/api/live/customer?id=${encodeURIComponent(id)}&mode=${mode}&minutes=${minutes}`,
      // Realtime pushes claim changes; polling keeps offers fresh as the clock moves.
      asMe ? 5000 : 3000,
      (d) => {
        setLive(d as Live);
        setError(null);
      },
      setError,
    );
    poller.current = p;
    return p;
  }, [id, mode, minutes, asMe, ready]);

  const realtime = useRealtime("claims", asMe && me?.user ? `customer_user_id=eq.${me.user.id}` : null, () => poller.current?.refresh());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => !q || `${c.name} ${c.locality} ${c.language}`.toLowerCase().includes(q)).slice(0, 120);
  }, [customers, query]);

  function choose(next: string) {
    setId(next);
    setLive(null);
    setScreen("lock");
    setActiveCode(null);
    setClaimError(null);
  }

  async function claim(merchantId: string) {
    setClaiming(merchantId);
    setClaimError(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(asMe ? { me: true, merchant_id: merchantId, mode, minutes } : { customer_id: id, merchant_id: merchantId, mode, minutes }),
      });
      const data = await res.json();
      if (!res.ok) setClaimError(data.error ?? "Couldn't claim this offer");
      else {
        setActiveCode(data.claim.code);
        setScreen("code");
        setLive((cur) => (cur ? { ...cur, claims: [data.claim, ...cur.claims] } : cur));
      }
    } catch {
      setClaimError("Couldn't reach the server. Try again.");
    } finally {
      setClaiming(null);
    }
  }

  const offers = (live?.nearby ?? []).filter((n) => n.response.action === "send");
  const best = offers[0];
  const claimed = live?.claims.find((c) => c.code === activeCode) ?? null;
  const phoneTime = live ? live.moment.iso.slice(11, 16) : "13:15";

  return (
    <div className="mx-auto grid max-w-[1360px] gap-6 px-4 pb-24 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_330px]">
      <aside className="order-3 lg:sticky lg:top-4 lg:order-none lg:self-start">
        {asMe && me?.profile ? (
          <Panel title="Your account">
            <dl className="space-y-2.5 text-[14px]">
              <div>
                <dt className="text-[12.5px] text-muted">Area</dt>
                <dd className="font-medium">{me.profile.locality}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Language</dt>
                <dd className="font-medium">{LANG_NAME[me.profile.language] ?? me.profile.language}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Offers</dt>
                <dd className={`font-medium ${me.profile.marketing_consent ? "text-ok" : "text-bad"}`}>{me.profile.marketing_consent ? "On" : "Off"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/onboarding" className="rounded-full border border-line-strong px-4 py-2 text-center text-[14px] hover:bg-surface-2">
                Edit profile
              </Link>
              <button type="button" onClick={() => setDemo(true)} className="rounded-full px-4 py-2 text-[13.5px] text-muted hover:text-text">
                Browse demo customers
              </button>
            </div>
            <p className="mt-3 text-[12.5px] text-muted">{realtime ? "Live: codes update the moment a shop redeems them." : "Updates every few seconds."}</p>
          </Panel>
        ) : (
        <Panel title="Customers" aside={`${customers.length} in the dataset`}>
          <input
            type="search"
            aria-label="Search customers"
            placeholder="Search name, area or language"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 text-[14px] placeholder:text-muted"
          />
          <ul className="-mx-2 mt-3 max-h-[42vh] overflow-y-auto lg:max-h-[64vh]">
            {shown.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-current={c.id === id ? "true" : undefined}
                  className={`w-full rounded-[10px] px-2 py-2 text-left ${c.id === id ? "bg-accent-tint" : "hover:bg-surface-2"}`}
                >
                  <span className="block truncate text-[14px] font-medium">{c.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {c.locality}, {LANG_NAME[c.language] ?? c.language}, {c.nearby} shops nearby
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2 py-3 text-[13.5px] text-muted">No customer matches “{query}”.</li>}
          </ul>
          {mine && (
            <button type="button" onClick={() => setDemo(false)} className="mt-3 w-full rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent">
              Back to my offers
            </button>
          )}
        </Panel>
        )}
      </aside>

      <div className="order-2 min-w-0 space-y-6 lg:order-none">
        <div className="flex flex-col gap-4 pt-1">
          {ready && !asMe && (
            <p className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-[14px] text-muted">
              {me?.user ? (
                mine ? (
                  "Demo mode: you're browsing the dataset's customers."
                ) : (
                  <>
                    Demo mode.{" "}
                    <Link href="/onboarding?as=customer" className="font-semibold text-text underline underline-offset-2">
                      Finish your profile
                    </Link>{" "}
                    to get offers for you.
                  </>
                )
              ) : me?.login ? (
                <>
                  Demo mode: you&apos;re browsing the dataset&apos;s customers.{" "}
                  <Link href="/login" className="font-semibold text-text underline underline-offset-2">
                    Sign in
                  </Link>{" "}
                  to get offers for you.
                </>
              ) : (
                "Demo mode: browsing the dataset's customers."
              )}
            </p>
          )}
          <h1 className="title text-[clamp(28px,3.4vw,42px)]">
            {asMe ? `Hi ${(me?.profile?.display_name ?? live?.customer.name ?? "there").split(" ")[0]}, here's what's near you` : live ? `What ${live.customer.name.split(" ")[0]} sees right now` : "What they see right now"}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <ClockChip moment={live?.moment ?? null} mode={mode} />
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>

        {error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{error}</p>}

        {live && (
          <Panel title={live.customer.name} aside={live.customer.locality}>
            <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-3">
              <Fact label="Language" value={LANG_NAME[live.customer.language] ?? live.customer.language} />
              <Fact label="Marketing consent" value={live.customer.marketing_consent ? "Opted in" : "Opted out"} bad={!live.customer.marketing_consent} />
              <Fact label="Declared interests" value={live.customer.declared_preferences.join(", ") || "None declared"} />
            </dl>
            <div className="mt-4 border-t border-line pt-1">
              <Slider label="Free time right now" value={minutes} min={5} max={90} step={5} onChange={setMinutes} format={(v) => `${v} min`} />
            </div>
          </Panel>
        )}

        <Panel title="Shops within a short walk" aside={live ? `${live.nearby.length} within ${(live.radius_m / 1000).toFixed(1)} km, ${offers.length} sending` : undefined}>
          <ul className="divide-y divide-line">
            {(live?.nearby ?? []).map((n) => (
              <li key={n.merchant.id} className="flex items-start gap-3 py-3">
                <FoodGlyph category={n.merchant.category} size={28} className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">
                    {n.merchant.name}
                    <span className="font-normal text-muted">, {n.distance_m} m</span>
                  </span>
                  <span className="block text-[13px] text-muted">
                    {n.response.action === "send" && n.response.offer
                      ? `${n.response.offer.discount_pct ? `${n.response.offer.discount_pct}% off ` : "Full price: "}${n.item_name} for ${inr(n.response.offer.final_price_inr)}`
                      : n.response.reason}
                  </span>
                </span>
                {n.response.action === "send" ? <Chip tone="accent">Offer</Chip> : <Chip tone="muted">Skip</Chip>}
              </li>
            ))}
            {live && live.nearby.length === 0 && (
              <li className="py-4 text-[14px] text-muted">No shop in the dataset is within a 1.5 km walk of {live.customer.name.split(" ")[0]}. Pick someone else from the list.</li>
            )}
            {!live && !error && <li className="py-6 text-center text-[14px] text-muted">Checking nearby shops…</li>}
          </ul>
          <div className="mt-3">
            <StoreNote store={live?.store ?? null} error={live?.store_error} />
          </div>
        </Panel>
      </div>

      <div className="order-1 lg:order-none lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4 xl:self-start">
        <div className="mb-4 flex justify-center">
          <div role="tablist" aria-label="Phone view" className="flex gap-1 rounded-full bg-surface-2 p-1">
            {(
              [
                ["lock", "Notification"],
                ["offers", `Offers (${offers.length})`],
                ["code", "My code"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={screen === v}
                onClick={() => setScreen(v)}
                disabled={v === "code" && !activeCode}
                className={`rounded-full px-3.5 py-1.5 text-[13px] disabled:opacity-40 ${screen === v ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Phone time={phoneTime}>
          {screen === "lock" && (
            <div className="flex flex-1 flex-col px-4 pt-10" style={{ background: "linear-gradient(180deg, var(--lock-a), var(--lock-b))" }}>
              <p className="text-center text-[15px] font-medium text-muted">{live?.moment.label.split(" ")[0] ?? ""}</p>
              <p className="display text-center text-[72px] leading-none tracking-[-0.04em]">{live ? live.moment.label.split(" ")[1] : "…"}</p>
              <div className="mt-8">
                <AnimatePresence mode="wait">
                  {best?.response.notification ? (
                    <motion.button
                      key={`${best.merchant.id}-${best.response.offer?.final_price_inr}`}
                      type="button"
                      onClick={() => setScreen("offers")}
                      initial={reduce ? false : { opacity: 0, y: -14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="w-full rounded-[22px] bg-surface/90 p-3.5 text-left shadow-[0_8px_30px_-12px_rgb(30_23_18/0.35)] backdrop-blur"
                    >
                      <span className="flex items-center gap-2 text-[12px] text-muted">
                        <LogoMark size={18} />
                        <span className="font-semibold text-text">AscenDex</span>
                        <span className="ml-auto">now</span>
                      </span>
                      <span className="mt-1.5 block text-[15px] font-semibold leading-snug">{best.response.notification.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-text/85">{best.response.notification.body}</span>
                    </motion.button>
                  ) : (
                    <motion.p key="none" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[220px] text-center text-[13px] leading-snug text-muted">
                      {live
                        ? live.customer.marketing_consent
                          ? "Nothing worth a notification right now. AscenDex stays quiet."
                          : "Opted out of offers, so nothing is ever sent."
                        : "…"}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {screen === "offers" && (
            <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-5 pt-5">
              <p className="text-[13px] text-muted">Near you, right now</p>
              <p className="title mt-0.5 text-[21px]">{offers.length ? `${offers.length} offer${offers.length > 1 ? "s" : ""}` : "No offers"}</p>
              {claimError && <p className="mt-3 rounded-[12px] bg-bad-tint px-3 py-2 text-[12.5px] text-bad">{claimError}</p>}
              <div className="mt-3 space-y-3">
                {offers.map((n) => (
                  <article key={n.merchant.id} className="overflow-hidden rounded-[20px] bg-surface shadow-[0_10px_40px_-18px_rgb(30_23_18/0.4)]">
                    <div className="flex items-center gap-3 p-3.5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent text-on-accent">
                        <FoodGlyph category={n.merchant.category} size={30} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">{n.merchant.name}</span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {n.item_name}, {n.response.ui_hints.walk_minutes ?? "?"} min walk
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-line px-3.5 py-2.5">
                      <span>
                        <span className="text-[19px] font-bold">{inr(n.response.offer!.final_price_inr)}</span>
                        {n.response.offer!.discount_pct > 0 && n.base_price_inr && <span className="ml-1.5 text-[13px] text-muted line-through">{inr(n.base_price_inr)}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => claim(n.merchant.id)}
                        disabled={claiming !== null}
                        className="rounded-full bg-text px-3.5 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-50"
                      >
                        {claiming === n.merchant.id ? "Claiming…" : n.response.notification?.cta ?? "Claim offer"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {screen === "code" && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              {claimed ? (
                <>
                  <p className="text-[13px] text-muted">Show this at the counter</p>
                  <p className="mt-2 font-mono text-[34px] font-bold tracking-[0.12em]">{claimed.code}</p>
                  <p className="mt-3 text-[15px] font-semibold">{claimed.merchant_name}</p>
                  <p className="text-[14px] text-muted">
                    {claimed.item_name}, {inr(claimed.final_price_inr)}
                    {claimed.discount_pct ? ` (${claimed.discount_pct}% off)` : ""}
                  </p>
                  <div className="mt-6">
                    {claimed.status === "redeemed" ? (
                      <motion.span initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex">
                        <Chip tone="ok">Redeemed at {claimed.redeemed_at ? timeOf(claimed.redeemed_at) : "the counter"}</Chip>
                      </motion.span>
                    ) : (
                      <Chip tone="accent">Valid till {timeOf(claimed.valid_until)}</Chip>
                    )}
                  </div>
                  <p className="mt-6 max-w-[220px] text-[12.5px] text-muted">The shop sees this claim on its dashboard. This screen updates when they redeem it.</p>
                </>
              ) : (
                <p className="text-[13px] text-muted">Claim an offer to get a code.</p>
              )}
            </div>
          )}
        </Phone>
        {live && live.claims.length > 0 && (
          <div className="mx-auto mt-5 max-w-[300px]">
            <p className="text-[13px] text-muted">Claimed by {live.customer.name.split(" ")[0]}</p>
            <ul className="mt-2 space-y-1.5">
              {live.claims.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCode(c.code);
                      setScreen("code");
                    }}
                    className="flex w-full items-center justify-between gap-2 text-left text-[13px]"
                  >
                    <span className="truncate">
                      <span className="font-mono font-semibold">{c.code}</span> {c.merchant_name}
                    </span>
                    <Chip tone={c.status === "redeemed" ? "ok" : "accent"}>{c.status === "redeemed" ? "Redeemed" : "Open"}</Chip>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-medium ${bad ? "text-bad" : ""}`}>{value}</dd>
    </div>
  );
}
