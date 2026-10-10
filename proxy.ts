// Next.js 16 proxy (formerly middleware): refreshes the Supabase session cookie
// on page and app-API requests, so server code always sees a valid login.
// The evaluator endpoints (/decide, /api/decide) and static files skip it.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, authConfigured } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!authConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, String(v));
      },
    },
  });

  // Verifies the JWT and refreshes it when needed. Do not put code between the
  // client creation and this call.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|decide|api/decide|api/solve|api/simulate|api/dataset|api/health).*)"],
};
