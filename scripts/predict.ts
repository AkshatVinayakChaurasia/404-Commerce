// Runs every official scenario through POST /decide's logic, writes
// submissions/*.jsonl in the organizers' format, and scores the public set with
// the evaluator port in lib/official/score.ts.   npm run predict
//
// Upload submissions/ps01_submission.jsonl: holdout + public, one line per scenario.

import { mkdirSync, writeFileSync } from "node:fs";
import { dataset } from "../lib/official/adapter";
import { evaluate, predictAll } from "../lib/official/score";

/**
 * JSON with every non-ASCII character escaped (₹ becomes ₹). The organizers'
 * evaluator opens the file without naming an encoding, so a pure-ASCII file parses
 * the same on any machine.
 */
const asciiJson = (v: unknown) =>
  JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

async function run() {
  mkdirSync("submissions", { recursive: true });
  const all: string[] = [];
  for (const [name, rows] of [
    ["holdout_blind", dataset.scenarios_holdout_blind],
    ["public", dataset.scenarios_public],
  ] as const) {
    const preds = await predictAll(rows);
    const lines = [...preds.values()].map(asciiJson);
    all.push(...lines);
    writeFileSync(`submissions/${name}.jsonl`, lines.join("\n") + "\n");
    const sends = [...preds.values()].filter((p) => p.action === "send").length;
    console.log(`${name}: ${rows.length} scenarios, ${sends} send, ${rows.length - sends} skip -> submissions/${name}.jsonl`);
    if (name !== "public") continue;
    const s = evaluate(rows as never, preds);
    console.log(`  labels matched: ${s.matched}/${s.n}`);
    console.log("  score (evaluator port):", Object.fromEntries(Object.entries(s).filter(([k]) => !["matched", "n"].includes(k)).map(([k, v]) => [k, Math.round(v * 1000) / 1000])));
    for (const r of rows as { id: string; scenario_type: string; expected_action?: string }[]) {
      const p = preds.get(r.id)!;
      if (p.action !== r.expected_action) console.log(`  differs ${r.id} (${r.scenario_type}): label ${r.expected_action}, ours ${p.action}: ${p.reason}`);
    }
  }
  writeFileSync("submissions/ps01_submission.jsonl", all.join("\n") + "\n");
  console.log(`submissions/ps01_submission.jsonl: ${all.length} predictions. Upload this file.`);
}
run();
