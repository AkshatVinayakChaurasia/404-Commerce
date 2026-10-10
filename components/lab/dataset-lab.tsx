"use client";

// Decision Lab, official-dataset mode: every scenario from the PS-01 files,
// decided by POST /decide. Public scenarios show the organizers' label next to
// our answer; the blind holdout has no labels.

import { useEffect, useMemo, useState } from "react";
import type { SolveResult } from "@/lib/engine/types";
import type { OfficialResponse } from "@/lib/official/adapter";
import { Chip, Panel } from "@/components/ui";
import { EngineView, PhoneView } from "./engine-view";

type Row = {
  id: string;
  split: string;
  title: string;
  type: string;
  timestamp: string;
  prompt: string;
  customer: { id: string; name: string; language: string };
  merchant: { id: string; name: string; category: string };
  minutes_available: number | null;
  expected_action?: string;
};

type Full = OfficialResponse & { engine: SolveResult | null; context_overrides: string[] };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(ts: string) {
  const d = new Date(`${ts.slice(0, 10)}T00:00:00Z`);
  const [h, m] = ts.slice(11, 16).split(":").map(Number);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}, ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

async function post<T>(body: unknown, trace = false): Promise<T> {
  const res = await fetch(`/decide${trace ? "?trace=1" : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function DatasetLab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [split, setSplit] = useState<"public" | "holdout">("public");
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<Record<string, "send" | "skip">>({});
  const [selected, setSelected] = useState("cur_001");
  const [full, setFull] = useState<Full | null>(null);
  const [runs, setRuns] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/dataset");
        const data: { scenarios: Row[] } = await res.json();
        if (!live) return;
        setRows(data.scenarios);
        const all: OfficialResponse[] = await post(data.scenarios.map((s) => ({ id: s.id })));
        if (live) setAnswers(Object.fromEntries(all.map((a) => [a.scenario_id, a.action])));
      } catch {
        if (live) setError("Couldn't load the dataset from /api/dataset. Check that the server is running, then reload.");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    post<Full>({ id: selected }, true)
      .then((r) => {
        if (!live) return;
        setFull(r);
        setRuns((n) => n + 1);
      })
      .catch(() => live && setError(`Couldn't decide ${selected}. Check that /decide is reachable.`));
    return () => {
      live = false;
    };
  }, [selected]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (split === "public" ? r.split !== "holdout" : r.split === "holdout") &&
        (!q || `${r.id} ${r.title} ${r.type} ${r.customer.name} ${r.merchant.name}`.toLowerCase().includes(q)),
    );
  }, [rows, split, query]);

  const publicRows = rows.filter((r) => r.expected_action);
  const scored = publicRows.filter((r) => answers[r.id]);
  const matches = scored.filter((r) => answers[r.id] === r.expected_action).length;
  const row = rows.find((r) => r.id === selected);
  const result = full?.engine ?? null;
  const official: OfficialResponse | null = full
    ? { scenario_id: full.scenario_id, action: full.action, reason: full.reason, offer: full.offer, notification: full.notification, ui_hints: full.ui_hints, profit_estimate_inr: full.profit_estimate_inr }
    : null;

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_310px]">
      <aside className="order-3 lg:sticky lg:top-4 lg:order-none lg:self-start">
        <Panel
          title="Scenarios"
          aside={scored.length === publicRows.length && publicRows.length ? `${matches} of ${publicRows.length} public labels matched` : "Scoring…"}
        >
          <div role="tablist" aria-label="Scenario set" className="flex gap-1 rounded-[var(--radius-control)] bg-surface-2 p-1">
            {(["public", "holdout"] as const).map((s) => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={split === s}
                onClick={() => setSplit(s)}
                className={`flex-1 rounded-[9px] py-1.5 text-[13.5px] ${split === s ? "bg-bg font-semibold" : "text-muted"}`}
              >
                {s === "public" ? `Public (${publicRows.length})` : `Holdout blind (${rows.length - publicRows.length})`}
              </button>
            ))}
          </div>
          <input
            type="search"
            aria-label="Search scenarios"
            placeholder="Search by id, type, person or merchant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-3 w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 text-[14px] placeholder:text-muted"
          />
          <ul className="-mx-2 mt-3 max-h-[60vh] overflow-y-auto">
            {shown.map((r) => {
              const ours = answers[r.id];
              const hit = r.expected_action && ours ? ours === r.expected_action : undefined;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    aria-current={selected === r.id ? "true" : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-[10px] px-2 py-2 text-left ${selected === r.id ? "bg-accent-tint" : "hover:bg-surface-2"}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ours === "send" ? "bg-accent" : ours === "skip" ? "bg-muted" : "bg-line-strong"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{r.title.replace(/^Holdout · /, "")}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {r.id}, {r.type}
                      </span>
                    </span>
                    {hit !== undefined && (
                      <span className={`text-[12px] font-semibold ${hit ? "text-ok" : "text-bad"}`} aria-label={hit ? "matches label" : "differs from label"}>
                        {hit ? "match" : "differs"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </aside>

      <div className="order-1 min-w-0 space-y-5 lg:order-none" aria-live="polite">
        {error && <p className="rounded-[var(--radius-control)] bg-bad-tint px-4 py-3 text-[14px] text-bad">{error}</p>}
        <select
          aria-label="Choose a scenario"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-[15px] lg:hidden"
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id}: {r.title.replace(/^Holdout · /, "")}
            </option>
          ))}
        </select>
        {row && (
          <Panel title={row.title.replace(/^Holdout · /, "")} aside={`${row.id}, ${when(row.timestamp)}`}>
            <p className="max-w-[75ch] text-[15px] text-muted">{row.prompt}</p>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="Customer" value={`${row.customer.name} (${row.customer.language})`} />
              <Fact label="Merchant" value={`${row.merchant.name}, ${row.merchant.category}`} />
              <Fact label="Time available" value={row.minutes_available !== null ? `${row.minutes_available} min` : "not given"} />
              <Fact
                label="Label vs ours"
                value={
                  row.expected_action ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Chip tone="muted">label: {row.expected_action}</Chip>
                      {full && <Chip tone={full.action === row.expected_action ? "ok" : "bad"}>ours: {full.action}</Chip>}
                    </span>
                  ) : (
                    "blind, no label"
                  )
                }
              />
            </dl>
            {full && full.context_overrides.length > 0 && (
              <p className="mt-3 text-[13px] text-muted">Context from the scenario: {full.context_overrides.join("; ")}.</p>
            )}
          </Panel>
        )}
        <EngineView
          result={result}
          runs={runs}
          context={row ? `${row.id}: ${when(row.timestamp)}` : selected}
          request={{ id: selected }}
          response={official}
          maxPct={result?.trace.tiers.at(-1)?.pct}
        />
      </div>

      <div className="order-2 lg:order-none lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4 xl:self-start">
        {row && <PhoneView result={result} time={row.timestamp.slice(11, 16)} dateLabel={when(row.timestamp).split(",")[0]} userName={row.customer.name.split(" ")[0]} />}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
