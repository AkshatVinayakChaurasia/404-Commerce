import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Google sends the user back here with a one-time code. Exchange it for a session
// cookie, then continue to `next` (only same-site paths are allowed).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/onboarding";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/onboarding";
  const supabase = await supabaseServer();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=signin", url.origin));
}
