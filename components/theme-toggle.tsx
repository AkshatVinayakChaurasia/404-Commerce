"use client";

import { useSyncExternalStore } from "react";

import { THEME_KEY as KEY } from "@/lib/head-cleanup";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const read = () => document.documentElement.getAttribute("data-theme") ?? "";

/**
 * Flips between dark and light. With no saved choice, the page's own designed
 * theme (`pageDefault`) is shown; a choice is saved and applies on every page.
 */
export function ThemeToggle({ pageDefault }: { pageDefault: "dark" | "light" }) {
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const current = saved === "dark" || saved === "light" ? saved : pageDefault;
  const next = current === "dark" ? "light" : "dark";

  function flip() {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this page view only
    }
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-text"
    >
      {current === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
