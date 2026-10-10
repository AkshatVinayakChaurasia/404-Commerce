import { effectiveRules } from "@/lib/live/feed";
import { getStore } from "@/lib/store";
import { bad, cleanRules } from "@/lib/live/api";
import { canManageShop } from "@/lib/live/guard";

// POST /api/live/rules { merchant_id, rules } saves owner overrides for the live app.
// { merchant_id, reset: true } returns the merchant to the dataset's rules.
// Owned shops: only the owner's account. POST /decide always uses the dataset's rules.
export async function POST(request: Request) {
  let body: { merchant_id?: string; rules?: unknown; reset?: boolean };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON: { merchant_id, rules }");
  }
  const id = String(body.merchant_id ?? "");
  const access = await canManageShop(id);
  if (!access.ok) return bad(access.error, access.status);
  const store = getStore();
  try {
    if (body.reset) {
      await store.clearRules(id);
      return Response.json({ rules: effectiveRules(id, null), overridden: false });
    }
    const rules = cleanRules(body.rules);
    if (!rules) return bad("rules must be an object");
    const merged = { ...((await store.getRules(id)) ?? {}), ...rules };
    await store.setRules(id, merged, access.viewer?.user.id ?? null);
    return Response.json({ rules: effectiveRules(id, merged), overridden: true });
  } catch (e) {
    return bad(`Couldn't save the rules: ${(e as Error).message}`, 502);
  }
}
