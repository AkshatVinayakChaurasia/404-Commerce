"use client";

// The question at the door of /merchant and /customer: "Are you a shop owner?" /
// "Looking for offers near you?". Signed-out visitors can sign in for that role
// or keep exploring the demo; signed-in people with the other role are pointed
// to their own page. The choice to explore is remembered for the session.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GoogleButton } from "./google-button";
import { useViewer } from "./use-viewer";

type Role = "customer" | "merchant";

const COPY: Record<Role, { ask: string; why: string; mine: string; minePath: string; noun: string }> = {
  merchant: {
    ask: "Are you a shop owner?",
    why: "Sign in to run your own shop: live decisions with the reason behind each one, your discount rules, and the counter.",
    mine: "Go to my shop",
    minePath: "/merchant",
    noun: "a shop owner",
  },
  customer: {
    ask: "Looking for offers near you?",
    why: "Sign in to get offers from shops in your area, in your language, only when you want them.",
    mine: "Go to my offers",
    minePath: "/customer",
    noun: "a customer",
  },
};

const KEY = (role: Role) => `ascendex-explore-${role}`;

function remembered(role: Role) {
  try {
    return sessionStorage.getItem(KEY(role)) === "1";
  } catch {
    return false;
  }
}

export function RoleGate({ role }: { role: Role }) {
  const { me, ready } = useViewer();
  const [exploring, setExploring] = useState(true);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Read the session choice after mount (storage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExploring(remembered(role));
  }, [role]);

  const p = me?.profile;
  const setUp = p?.role === "merchant" ? Boolean(p.merchant_id) : p?.role === "customer" ? Boolean(p.locality) : false;
  const other: Role | null = p?.role && p.role !== role && setUp ? p.role : null;

  let kind: "signin" | "other" | "finish" | null = null;
  if (ready && me?.login && !exploring) {
    if (!me.user) kind = "signin";
    else if (other) kind = "other";
    else if (!(p?.role === role && setUp)) kind = "finish";
  }

  useEffect(() => {
    if (!kind) return;
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && explore();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function explore() {
    try {
      sessionStorage.setItem(KEY(role), "1");
    } catch {
      // storage blocked: the dialog closes for this page view only
    }
    setExploring(true);
  }

  if (!kind) return null;
  const c = COPY[role];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="gate-title" className="theme-light max-h-[calc(100dvh-32px)] w-full max-w-[460px] overflow-y-auto rounded-[var(--radius-panel)] bg-bg p-6 text-text shadow-2xl sm:p-8">
        {kind === "signin" && (
          <>
            <h2 id="gate-title" className="title text-[26px]">
              {c.ask}
            </h2>
            <p className="mt-2 text-[15px] text-muted">{c.why}</p>
            <div className="mt-6">
              <GoogleButton as={role} label="Yes, sign in with Google" />
            </div>
            <button ref={first} type="button" onClick={explore} className="mt-3 w-full rounded-full border border-line-strong py-3 text-[15px] font-medium hover:bg-surface">
              No, I&apos;m just exploring
            </button>
            <p className="mt-4 text-[12.5px] text-muted">Exploring shows the demo with the dataset&apos;s {role === "merchant" ? "shops" : "customers"}. Nothing is saved to an account.</p>
          </>
        )}
        {kind === "other" && other && (
          <>
            <h2 id="gate-title" className="title text-[26px]">
              You&apos;re signed in as {COPY[other].noun}
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              This page is for {c.noun}. Your own page is one click away, or switch your account&apos;s role.
            </p>
            <Link href={COPY[other].minePath} className="mt-6 block w-full rounded-full bg-text py-3 text-center text-[15px] font-semibold text-bg">
              {COPY[other].mine}
            </Link>
            <Link href={`/onboarding?as=${role}`} className="mt-3 block w-full rounded-full border border-line-strong py-3 text-center text-[15px] font-medium hover:bg-surface">
              Switch my account to {c.noun}
            </Link>
            <button ref={first} type="button" onClick={explore} className="mt-2 w-full py-2.5 text-[14px] text-muted hover:text-text">
              Just explore the demo
            </button>
          </>
        )}
        {kind === "finish" && (
          <>
            <h2 id="gate-title" className="title text-[26px]">
              One step left
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              {role === "merchant" ? "Choose the shop you run to open its dashboard." : "Choose your area and language to see offers near you."}
            </p>
            <Link href={`/onboarding?as=${role}`} className="mt-6 block w-full rounded-full bg-accent py-3 text-center text-[15px] font-semibold text-on-accent">
              {role === "merchant" ? "Choose my shop" : "Set up my offers"}
            </Link>
            <button ref={first} type="button" onClick={explore} className="mt-2 w-full py-2.5 text-[14px] text-muted hover:text-text">
              Just explore the demo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
