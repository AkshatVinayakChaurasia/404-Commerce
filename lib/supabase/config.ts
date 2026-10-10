// Which Supabase pieces are configured. Safe to import anywhere: it reads only
// public env vars, plus server-only ones that are undefined in the browser.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Google login and realtime need the URL and the publishable key. */
export const authConfigured = () => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/**
 * The server's write key. A publishable key here would silently fail every
 * write (RLS blocks it), so it is rejected and reported instead.
 */
export function secretKey(): { key: string | null; problem: string | null } {
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) return { key: null, problem: "SUPABASE_SECRET_KEY is not set" };
  if (key.startsWith("sb_publishable_")) return { key: null, problem: "SUPABASE_SECRET_KEY holds a publishable key; use the sb_secret_ key" };
  return { key, problem: null };
}
