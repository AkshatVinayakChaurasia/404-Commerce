"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, authConfigured } from "./config";

let client: SupabaseClient | null = null;

/** The browser client (Google login, realtime). Null when Supabase isn't configured. */
export function supabaseBrowser(): SupabaseClient | null {
  if (!authConfigured()) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
