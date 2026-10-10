"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Notification, Offer, UiComponent } from "@/lib/engine/types";
import { FoodGlyph } from "./food-glyph";
import { LogoMark } from "./logo";
import { clock, inr } from "@/lib/format";

export function Phone({ time, children, className = "" }: { time: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-[300px] max-w-full rounded-[46px] p-[10px] ${className}`}
      style={{
        background: "#2b2019",
        boxShadow: "0 0 0 1px rgb(243 237 230 / 0.12), 0 30px 80px -20px rgb(0 0 0 / 0.55)",
      }}
    >
      <div className="theme-light relative flex h-[600px] flex-col overflow-hidden rounded-[37px] bg-bg text-text">
        <div className="flex items-center justify-between px-7 pt-3.5 text-[13px] font-semibold">
          <span>{clock(time).replace(/ [AP]M$/, "")}</span>
          <span className="h-[22px] w-[86px] rounded-full bg-[#2b2019]" aria-hidden="true" />
          <span className="flex items-center gap-1" aria-hidden="true">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
              <rect x="0" y="7" width="3" height="4" rx="1" />
              <rect x="4.3" y="5" width="3" height="6" rx="1" />
              <rect x="8.6" y="2.5" width="3" height="8.5" rx="1" />
              <rect x="12.9" y="0" width="3" height="11" rx="1" />
            </svg>
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none" stroke="currentColor">
              <rect x="0.5" y="0.5" width="20" height="10" rx="3" />
              <rect x="2.5" y="2.5" width="12" height="6" rx="1.5" fill="currentColor" />
            </svg>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LockScreen({
  time,
  dateLabel,
  notification,
  emptyNote,
}: {
  time: string;
  dateLabel: string;
  notification?: Notification;
  emptyNote?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-1 flex-col px-4 pt-10" style={{ background: "linear-gradient(180deg, #f1ece6, #e9e2da)" }}>
      <p className="text-center text-[15px] font-medium text-muted">{dateLabel}</p>
      <p className="display text-center text-[76px] leading-none tracking-[-0.04em]">
        {clock(time).replace(/ [AP]M$/, "")}
      </p>
      <div className="mt-8">
        <AnimatePresence mode="wait">
          {notification ? (
            <motion.div
              key={notification.title + notification.body}
              initial={reduce ? false : { opacity: 0, y: -14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[22px] bg-white/85 p-3.5 shadow-[0_8px_30px_-12px_rgb(30_23_18/0.35)] backdrop-blur"
            >
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <LogoMark size={18} />
                <span className="font-semibold text-text">AscenDex</span>
                <span className="ml-auto">now</span>
              </div>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug">{notification.title}</p>
              <p className="mt-0.5 text-[14px] leading-snug text-text/85">{notification.body}</p>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto max-w-[220px] text-center text-[13px] leading-snug text-muted"
            >
              {emptyNote ?? "No notification. Nothing was sent."}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const PANEL: Record<UiComponent, { bg: string; fg: string }> = {
  HeatOfferCard: { bg: "var(--jaggery)", fg: "#24160a" },
  RainOfferCard: { bg: "#dfe3e4", fg: "#1e2a2e" },
  EveningOfferCard: { bg: "var(--roast)", fg: "var(--foam)" },
  LunchOfferCard: { bg: "#fbe6cc", fg: "#3a2410" },
};

function Motif({ kind, color }: { kind: UiComponent; color: string }) {
  if (kind === "HeatOfferCard") {
    return (
      <svg className="absolute right-4 top-4" width="46" height="46" viewBox="0 0 46 46" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="23" cy="23" r="8" fill="none" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={23 + Math.cos(a) * 13} y1={23 + Math.sin(a) * 13} x2={23 + Math.cos(a) * 19} y2={23 + Math.sin(a) * 19} />;
        })}
      </svg>
    );
  }
  if (kind === "RainOfferCard") {
    return (
      <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden="true">
        <defs>
          <pattern id="rain" width="22" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <line x1="6" y1="0" x2="6" y2="10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="17" y1="13" x2="17" y2="21" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rain)" />
      </svg>
    );
  }
  if (kind === "EveningOfferCard") {
    return (
      <svg className="absolute right-5 top-5" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <path d="M21 4a12 12 0 1 0 5 18A10 10 0 0 1 21 4z" fill={color} opacity="0.85" />
      </svg>
    );
  }
  return null;
}

export function OfferScreen({
  offer,
  notification,
  component,
  userName,
}: {
  offer: Offer;
  notification?: Notification;
  component: UiComponent;
  userName: string;
}) {
  const [claimed, setClaimed] = useState(false);
  const reduce = useReducedMotion();
  const panel = PANEL[component];
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-5 pt-5">
      <p className="text-[13px] text-muted">For {userName}, near you</p>
      <p className="title mt-0.5 text-[21px]">{notification?.title ?? offer.item_name}</p>

      <motion.article
        key={offer.item_id + offer.discount_pct}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[24px] bg-surface shadow-[0_10px_40px_-18px_rgb(30_23_18/0.4)]"
      >
        <div className="relative flex h-[150px] items-end p-4" style={{ background: panel.bg, color: panel.fg }}>
          <Motif kind={component} color={panel.fg} />
          <FoodGlyph category={offer.category} size={84} className="relative" />
          <span
            className="absolute bottom-4 right-4 rounded-full px-2.5 py-1 text-[13px] font-bold"
            style={{ background: panel.fg, color: panel.bg }}
          >
            {offer.discount_pct}% off
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-2 text-[13px] text-muted">
            <span className="font-semibold text-text">{offer.merchant_name}</span>
            <span>
              {offer.walk_minutes} min walk{offer.rating ? `, ${offer.rating}★` : ""}
            </span>
          </div>
          <p className="title mt-1.5 text-[19px]">{offer.item_name}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-[24px] font-bold tracking-tight">{inr(offer.final_price)}</span>
            <span className="text-[15px] text-muted line-through">{inr(offer.base_price)}</span>
          </p>
          {notification && <p className="mt-2 text-[13.5px] leading-snug text-text/80">{notification.body}</p>}
          <button
            type="button"
            onClick={() => setClaimed(true)}
            disabled={claimed}
            className="mt-4 w-full rounded-[14px] bg-[var(--ink)] py-3 text-[15px] font-semibold text-[var(--foam)] transition-transform active:scale-[0.98] disabled:bg-ok"
          >
            {claimed ? `Claimed, valid till ${clock(offer.valid_until)}` : "Claim offer"}
          </button>
        </div>
      </motion.article>
    </div>
  );
}
