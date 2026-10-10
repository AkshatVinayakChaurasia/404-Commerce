import { getStore } from "@/lib/store";
import { bad } from "@/lib/live/api";
import { canManageShop } from "@/lib/live/guard";

// POST /api/claims/redeem { merchant_id, code } marks a claim redeemed at the counter.
// Owned shops: only the owner's account can redeem.
export async function POST(request: Request) {
  let body: { merchant_id?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON: { merchant_id, code }");
  }
  const mid = String(body.merchant_id ?? "");
  const code = String(body.code ?? "").trim().toUpperCase();
  const access = await canManageShop(mid);
  if (!access.ok) return bad(access.error, access.status);
  if (!/^AX-[A-Z0-9]{5}$/.test(code)) return bad("Codes look like AX-7K2QD");
  try {
    const claim = await getStore().redeem(code, mid);
    if (!claim) return bad(`${code} is not an open claim for this shop. It may already be redeemed.`, 404);
    const late = new Date(claim.valid_until).getTime() < Date.now();
    return Response.json({ claim: { ...claim, customer_id: undefined, customer_user_id: undefined }, warning: late ? "Redeemed after the offer window closed" : undefined });
  } catch (e) {
    return bad(`Couldn't redeem: ${(e as Error).message}`, 502);
  }
}
