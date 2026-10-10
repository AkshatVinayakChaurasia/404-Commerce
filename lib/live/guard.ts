// Shop ownership. A shop that someone has claimed in onboarding can only be
// changed (rules, redemptions) by that account. Unclaimed shops stay open so the
// public demo keeps working without a login.

import { getViewer, type Viewer } from "../auth";
import { getStore } from "../store";
import { merchantsById } from "./feed";

export type ShopAccess = { ok: true; viewer: Viewer | null; owned: boolean } | { ok: false; status: number; error: string };

export async function canManageShop(merchantId: string): Promise<ShopAccess> {
  const shop = merchantsById.get(merchantId);
  if (!shop) return { ok: false, status: 404, error: "Unknown merchant" };
  let owner: string | null = null;
  try {
    owner = await getStore().ownerOf(merchantId);
  } catch (e) {
    return { ok: false, status: 502, error: (e as Error).message };
  }
  const viewer = await getViewer();
  if (!owner) return { ok: true, viewer, owned: false };
  if (viewer?.user.id === owner) return { ok: true, viewer, owned: true };
  return { ok: false, status: 403, error: `${shop.name} is managed by its owner. Sign in with that account to change it.` };
}
