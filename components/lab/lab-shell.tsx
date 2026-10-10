"use client";

import { useState } from "react";
import { Lab } from "./lab";
import { DatasetLab } from "./dataset-lab";

const MODES = [
  { id: "dataset", label: "Official dataset" },
  { id: "playground", label: "Playground" },
] as const;

export function LabShell() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("dataset");
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-8">
      <div className="flex flex-col gap-5 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="title text-[clamp(32px,4vw,48px)]">Decision Lab</h1>
          <p className="mt-2 max-w-[62ch] text-[16px] text-muted">
            Every panel is drawn from a real engine response: the rules, the scores, the discount tiers and the phone.
            Nothing here is animated from a script.
          </p>
        </div>
        <div role="tablist" aria-label="Lab mode" className="flex gap-1 self-start rounded-full bg-surface-2 p-1 md:self-auto">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-full px-4 py-2 text-[14px] ${mode === m.id ? "bg-bg font-semibold" : "text-muted hover:text-text"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === "dataset" ? <DatasetLab /> : <Lab />}
    </div>
  );
}
