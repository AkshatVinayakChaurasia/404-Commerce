// Decision log. A no-op until the database is configured (SUPABASE_URL +
// SUPABASE_SECRET_KEY, schema from supabase/schema.sql). Writes go through
// PostgREST after the response is sent, so they never add latency to /decide or
// /api/solve. No customer data is logged.

import { after } from "next/server";
import { supabaseHeaders } from "../store";
import { SUPABASE_URL, secretKey } from "../supabase/config";

export type DecisionLog = {
  scenario_id: string;
  source: "decide" | "solve";
  action: "send" | "skip";
  merchant_id: string | null;
  item_id: string | null;
  discount_pct: number | null;
  final_price_inr: number | null;
  profit_estimate_inr: number | null;
  language: string | null;
  reason: string;
  latency_ms: number | null;
};

const url = () => process.env.SUPABASE_URL || SUPABASE_URL;
export const dbConfigured = () => Boolean(url() && secretKey().key);

export function logDecisions(rows: DecisionLog[]) {
  const { key } = secretKey();
  if (!url() || !key || rows.length === 0) return;
  after(async () => {
    try {
      await fetch(`${url().replace(/\/$/, "")}/rest/v1/decisions`, {
        method: "POST",
        headers: { ...supabaseHeaders(key), prefer: "return=minimal" },
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // Logging must never break a decision.
    }
  });
}
