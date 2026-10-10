import { connection } from "next/server";
import { getViewer } from "@/lib/auth";
import { authConfigured } from "@/lib/supabase/config";
import { getStore, storeProblem } from "@/lib/store";
import { merchantsById } from "@/lib/live/feed";

// GET /api/me: who is signed in, their profile, and which shops are already taken
// (for onboarding). Works signed out too: { login, user: null }.
export async function GET() {
  await connection();
  const store = getStore();
  const v = authConfigured() ? await getViewer() : null;
  let taken: string[] = [];
  try {
    taken = await store.ownedMerchantIds();
  } catch {
    taken = [];
  }
  const shop = v?.profile.merchant_id ? merchantsById.get(v.profile.merchant_id) : undefined;
  return Response.json({
    login: authConfigured(),
    store: store.kind,
    store_problem: store.kind === "memory" ? storeProblem() : null,
    user: v ? { id: v.user.id, email: v.user.email, name: v.profile.display_name ?? v.user.name, avatar_url: v.profile.avatar_url ?? v.user.avatar_url } : null,
    profile: v?.profile ?? null,
    shop: shop ? { id: shop.id, name: shop.name, category: shop.category, locality: shop.locality } : null,
    taken_merchant_ids: taken.filter((id) => id !== v?.profile.merchant_id),
  });
}
