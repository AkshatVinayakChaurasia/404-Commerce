"use client";

// The one orchestrated moment: a real engine run for Priya's Tuesday, replayed
// on a map. Merchants that fail a rule dim with the reason, the walking path to
// the chosen café draws, and the notification lands. Every label is read from
// the engine's trace, not typed in.

import { motion, useReducedMotion } from "motion/react";
import type { LatLng, MerchantGate, Notification, Offer } from "@/lib/engine/types";
import { LogoMark } from "./logo";

type Pin = { id: string; name: string; location: LatLng; label: string; tone: "bad" | "accent" | "muted" };

const W = 600;
const H = 520;
const CX = 270;
const CY = 230;
const PX_PER_M = 0.5;
const M_PER_DEG_LAT = 110_600;
const M_PER_DEG_LNG = 108_500;

function project(origin: LatLng, p: LatLng) {
  const x = CX + (p.lng - origin.lng) * M_PER_DEG_LNG * PX_PER_M;
  const y = CY - (p.lat - origin.lat) * M_PER_DEG_LAT * PX_PER_M;
  const inside = x > 24 && x < W - 24 && y > 24 && y < H - 24;
  return { x: Math.min(W - 24, Math.max(24, x)), y: Math.min(H - 24, Math.max(24, y)), inside };
}

export function HeroScene({
  user,
  pins,
  gates,
  offer,
  notification,
  clockLabel,
  weatherLabel,
}: {
  user: LatLng;
  pins: Pin[];
  gates: MerchantGate[];
  offer: Offer;
  notification: Notification;
  clockLabel: string;
  weatherLabel: string;
}) {
  const reduce = !!useReducedMotion();
  const at = (s: number) => (reduce ? 0 : s);
  const me = project(user, user);
  const chosen = pins.find((p) => p.id === offer.merchant_id)!;
  const cp = project(user, chosen.location);

  // An L-shaped walk along the street grid looks like a real route, not a crow line.
  const path = `M ${me.x} ${me.y} L ${me.x} ${cp.y} L ${cp.x} ${cp.y}`;
  const onMap = pins.filter((p) => project(user, p.location).inside);
  const offMap = pins.filter((p) => !project(user, p.location).inside);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Map of Koramangala. ${pins.length} merchants nearby; ${gates.filter((g) => g.passed).length} pass the rules. ${offer.merchant_name} is chosen, ${offer.walk_minutes} minutes away.`}>
          {/* street grid */}
          <g stroke="var(--line)" strokeWidth="1">
            {[70, 150, 330, 410].map((y) => (
              <line key={`h${y}`} x1="0" x2={W} y1={y} y2={y} />
            ))}
            {[90, 180, 360, 450, 540].map((x) => (
              <line key={`v${x}`} y1="0" y2={H} x1={x} x2={x} />
            ))}
          </g>
          <g stroke="var(--line-strong)" strokeWidth="9" strokeLinecap="round" opacity="0.55">
            <line x1="0" x2={W} y1={CY - 8} y2={CY - 8} />
            <line y1="0" y2={H} x1={CX + 6} x2={CX + 6} />
          </g>
          <text x="14" y={CY - 18} fill="var(--muted)" fontSize="11" opacity="0.8">80 Feet Road</text>
          <text x={CX + 18} y="22" fill="var(--muted)" fontSize="11" opacity="0.8">17th Main</text>

          {/* merchants: appear, then the rules rule some out */}
          {onMap.map((p, i) => {
            const g = gates.find((x) => x.merchant_id === p.id);
            const pos = project(user, p.location);
            const failed = g && !g.passed;
            const isChosen = p.id === offer.merchant_id;
            const anchorEnd = pos.x > W - 150;
            return (
              <motion.g
                key={p.id}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: at(0.25 + i * 0.07), duration: 0.4 }}
              >
                <motion.g
                  initial={false}
                  animate={{ opacity: failed ? 0.42 : 1 }}
                  transition={{ delay: at(1.2 + i * 0.06), duration: 0.5 }}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isChosen ? 9 : 6}
                    fill={isChosen ? "var(--accent)" : "var(--surface-2)"}
                    stroke={isChosen ? "var(--accent)" : "var(--muted)"}
                    strokeWidth="1.5"
                  />
                  <text
                    x={anchorEnd ? pos.x - 14 : pos.x + 14}
                    y={pos.y - 2}
                    textAnchor={anchorEnd ? "end" : "start"}
                    fill="var(--text)"
                    fontSize="15"
                    fontWeight={isChosen ? 650 : 500}
                  >
                    {p.name}
                  </text>
                </motion.g>
                <motion.text
                  x={anchorEnd ? pos.x - 14 : pos.x + 14}
                  y={pos.y + 15}
                  textAnchor={anchorEnd ? "end" : "start"}
                  fontSize="13"
                  fill={p.tone === "bad" ? "var(--bad)" : p.tone === "accent" ? "var(--accent-text)" : "var(--muted)"}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: at(isChosen ? 2.7 : 1.3 + i * 0.06), duration: 0.4 }}
                >
                  {p.label}
                </motion.text>
              </motion.g>
            );
          })}

          {offMap.map((p, i) => {
            const g = gates.find((x) => x.merchant_id === p.id);
            return (
              <text key={p.id} x="18" y={108 + i * 18} fontSize="13" fill="var(--muted)">
                {p.name}, {g ? `${(g.distance_m / 1000).toFixed(1)} km` : "off map"}:{" "}
                <tspan fill="var(--bad)">{p.label}</tspan>
              </text>
            );
          })}

          {/* the walk */}
          <motion.path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 7"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: at(2.0), duration: 0.9, ease: "easeInOut" }}
          />

          {/* Priya */}
          <circle cx={me.x} cy={me.y} r="22" fill="var(--accent)" opacity="0.12">
            {!reduce && <animate attributeName="r" values="14;26;14" dur="2.6s" repeatCount="indefinite" />}
          </circle>
          <circle cx={me.x} cy={me.y} r="8" fill="var(--text)" stroke="var(--bg)" strokeWidth="3" />
          <text x={me.x - 14} y={me.y + 26} textAnchor="end" fill="var(--text)" fontSize="15" fontWeight="650">
            Priya
          </text>
        </svg>
      </div>

      <div className="absolute left-4 top-4 rounded-full border border-line bg-bg/80 px-3 py-1.5 text-[13px] backdrop-blur">
        {clockLabel}, {weatherLabel}
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: at(3.0), duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="theme-light relative -mt-12 ml-auto mr-3 w-[min(330px,92%)] rounded-[22px] bg-surface p-4 text-text shadow-[0_24px_60px_-20px_rgb(0_0_0/0.7)] sm:-mt-16 sm:mr-[-18px]"
      >
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <LogoMark size={18} />
          <span className="font-semibold text-text">AscenDex</span>
          <span className="ml-auto">now</span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug">{notification.title}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-text/80">{notification.body}</p>
      </motion.div>
    </div>
  );
}
