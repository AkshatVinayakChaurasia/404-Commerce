"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { presetById } from "@/lib/data/koramangala";
import type { SolveResult } from "@/lib/engine/types";
import { LockScreen, OfferScreen, Phone } from "@/components/phone";
import { clock, inr } from "@/lib/format";

const MOMENTS = [
  { id: "priya-tuesday", label: "Tuesday lunch" },
  { id: "rainy-evening", label: "Rainy evening" },
  { id: "the-regular", label: "Arjun, a regular" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Customer() {
  const [moment, setMoment] = useState(MOMENTS[0].id);
  const [view, setView] = useState<"lock" | "offer">("offer");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState(false);
  const reduce = useReducedMotion();
  const scenario = useMemo(() => presetById(moment).build(), [moment]);

  useEffect(() => {
    let live = true;
    fetch("/api/solve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(scenario) })
      .then((r) => r.json())
      .then((r: SolveResult) => {
        if (live) {
          setResult(r);
          setError(false);
        }
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [scenario]);

  const [date, rest] = scenario.now.split("T");
  const time = rest.slice(0, 5);
  const dateObj = new Date(`${date}T00:00:00Z`);
  const dateLabel = `${DAY_NAMES[dateObj.getUTCDay()]}, ${dateObj.getUTCDate()} October`;
  const sent = result?.action === "send" && result.offer;
  const o = result?.offer;

  const notes: { title: string; body: string }[] =
    sent && o
      ? [
          {
            title: "Within her budget",
            body: `${inr(o.final_price)} of the ${inr(scenario.user.wallet_inr ?? 0)} in her wallet.`,
          },
          {
            title: "Close enough to go",
            body: `${o.merchant_name} is ${o.walk_minutes} min away on foot.`,
          },
          {
            title: "Timed to her day",
            body: scenario.user.free_until
              ? `Valid till ${clock(o.valid_until)}, when her lunch break ends.`
              : `Valid till ${clock(o.valid_until)}, inside the café's offer window.`,
          },
          {
            title: "Shaped by the moment",
            body:
              result.ui_configuration?.component === "RainOfferCard"
                ? `${scenario.context.weather.temp_c}° and raining, so the card says so${scenario.merchants.find((m) => m.id === o.merchant_id)?.indoor ? " and the pick has seats inside" : ""}.`
                : result.ui_configuration?.component === "HeatOfferCard"
                  ? `${scenario.context.weather.temp_c}° outside, so the cold option ranks first.`
                  : "The card follows the time of day.",
          },
        ]
      : result
        ? [
            { title: "Nothing arrived", body: result.reason },
            { title: "That's the point", body: "A notification that changes nothing costs the café margin and teaches people to swipe us away." },
          ]
        : [];

  const left = notes.slice(0, Math.ceil(notes.length / 2));
  const right = notes.slice(Math.ceil(notes.length / 2));

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
      <div className="flex flex-col gap-5 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="title text-[clamp(32px,4vw,48px)]">What {scenario.user.name} sees</h1>
          <p className="mt-2 max-w-[56ch] text-[16px] text-muted">
            The offer card is picked from a fixed set of layouts and filled with numbers the engine decided. The words can
            change; the price can&apos;t.
          </p>
        </div>
        <div role="group" aria-label="Moment" className="flex flex-wrap gap-2">
          {MOMENTS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={moment === m.id}
              onClick={() => setMoment(m.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[14px] transition-colors ${
                moment === m.id ? "border-accent bg-accent-tint text-accent-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">
          Couldn&apos;t reach /api/solve. Check the dev server is running, then pick a moment again.
        </p>
      )}

      <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <Notes items={left} align="right" reduce={!!reduce} k={moment} />
        <div>
          {sent && (
            <div className="mb-4 flex justify-center">
              <div role="tablist" aria-label="Phone view" className="flex gap-1 rounded-full bg-surface-2 p-1">
                {(["offer", "lock"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    type="button"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-full px-4 py-1.5 text-[13.5px] ${view === v ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}
                  >
                    {v === "lock" ? "Notification" : "Offer"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Phone time={time}>
            {sent && view === "offer" && o && result.ui_configuration ? (
              <OfferScreen offer={o} notification={result.notification} component={result.ui_configuration.component} userName={scenario.user.name} />
            ) : (
              <LockScreen time={time} dateLabel={dateLabel} notification={sent ? result?.notification : undefined} />
            )}
          </Phone>
        </div>
        <Notes items={right} align="left" reduce={!!reduce} k={moment} />
      </div>
    </div>
  );
}

function Notes({ items, align, reduce, k }: { items: { title: string; body: string }[]; align: "left" | "right"; reduce: boolean; k: string }) {
  return (
    <ul className={`space-y-8 ${align === "right" ? "lg:text-right" : ""}`}>
      <AnimatePresence mode="popLayout">
        {items.map((n, i) => (
          <motion.li
            key={`${k}-${n.title}`}
            initial={reduce ? false : { opacity: 0, x: align === "right" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: reduce ? 0 : 0.15 + i * 0.1, duration: 0.4 }}
            className={`max-w-[34ch] ${align === "right" ? "lg:ml-auto" : ""}`}
          >
            <p className="title text-[18px]">{n.title}</p>
            <p className="mt-1 text-[15px] text-muted">{n.body}</p>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
