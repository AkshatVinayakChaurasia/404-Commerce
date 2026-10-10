import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";

// Google sends the user back here with a one-time code. Exchange it for a session
// cookie on THIS origin (whatever domain the app is served from), then send the
// person where they belong:
//   - set-up merchant  -> /merchant      - set-up customer -> /customer
//   - asked for the other role, or not set up yet -> /onboarding?as=<role>
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const as = url.searchParams.get("as");
  const intent = as === "merchant" || as === "customer" ? as : null;
  const supabase = await supabaseServer();
  if (!code || !supabase) return NextResponse.redirect(new URL("/login?error=signin", url.origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=signin", url.origin));

  const v = await getViewer();
  const p = v?.profile;
  const ready = p?.role === "merchant" ? Boolean(p.merchant_id) : p?.role === "customer" ? Boolean(p.locality) : false;
  let dest = intent ? `/onboarding?as=${intent}` : "/onboarding";
  if (p && ready && (!intent || intent === p.role)) dest = p.role === "merchant" ? "/merchant" : "/customer";
  return NextResponse.redirect(new URL(dest, url.origin));
}
