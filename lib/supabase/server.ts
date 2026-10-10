import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, authConfigured } from "./config";

/** Server client bound to the request's auth cookies. Null when Supabase isn't configured. */
export async function supabaseServer() {
  if (!authConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy
          // refreshes the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}

export type SessionUser = { id: string; email: string | null; name: string | null; avatar_url: string | null };

/** The signed-in user, verified from the JWT (getClaims), or null. */
export async function sessionUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (error || !c?.sub) return null;
  const meta = (c.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: c.sub,
    email: (c.email as string | undefined) ?? null,
    name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    avatar_url: (meta.avatar_url as string | undefined) ?? null,
  };
}
