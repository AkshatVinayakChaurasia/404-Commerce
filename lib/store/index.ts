// Persistence for the live app: profiles, claimed offers, redemptions and owner
// rules. With SUPABASE_URL + SUPABASE_SECRET_KEY set, everything goes to Supabase
// (run supabase/schema.sql once). Without them, an in-memory store keeps the app
// working for one server process; the UI says so, because memory is lost on
// restart and is not shared between serverless instances.

import type { MerchantRules } from "../official/adapter";
import { SUPABASE_URL, secretKey } from "../supabase/config";

export type ClaimStatus = "claimed" | "redeemed";

export type Claim = {
  id: string;
  code: string;
  created_at: string;
  customer_id: string;
  customer_user_id: string | null;
  customer_name: string;
  merchant_id: string;
  merchant_name: string;
  item_id: string;
  item_name: string;
  discount_pct: number;
  base_price_inr: number;
  final_price_inr: number;
  unit_cost_inr: number;
  profit_estimate_inr: number | null;
  status: ClaimStatus;
  redeemed_at: string | null;
  valid_until: string;
};

export type NewClaim = Omit<Claim, "id" | "code" | "created_at" | "status" | "redeemed_at">;

export type Role = "customer" | "merchant";

export type Profile = {
  id: string;
  role: Role | null;
  display_name: string | null;
  avatar_url: string | null;
  merchant_id: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  language: string;
  interests: string[];
  marketing_consent: boolean;
};

export type ProfilePatch = Partial<Omit<Profile, "id">>;

export interface Store {
  kind: "supabase" | "memory";
  getRules(merchantId: string): Promise<MerchantRules | null>;
  setRules(merchantId: string, rules: MerchantRules, by?: string | null): Promise<MerchantRules>;
  clearRules(merchantId: string): Promise<void>;
  createClaim(c: NewClaim): Promise<Claim>;
  redeem(code: string, merchantId: string): Promise<Claim | null>;
  claimsForMerchant(merchantId: string, limit?: number): Promise<Claim[]>;
  claimsForCustomer(customerId: string, limit?: number): Promise<Claim[]>;
  claimsForUser(userId: string, limit?: number): Promise<Claim[]>;
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(userId: string, patch: ProfilePatch): Promise<Profile>;
  /** The user id that runs this shop, if any. */
  ownerOf(merchantId: string): Promise<string | null>;
  ownedMerchantIds(): Promise<string[]>;
}

function newCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `AX-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

const emptyProfile = (id: string): Profile => ({
  id,
  role: null,
  display_name: null,
  avatar_url: null,
  merchant_id: null,
  locality: null,
  lat: null,
  lng: null,
  language: "en",
  interests: [],
  marketing_consent: false,
});

// ── Memory ────────────────────────────────────────────────────────────────
type Mem = { rules: Map<string, MerchantRules>; claims: Claim[]; profiles: Map<string, Profile> };
const g = globalThis as unknown as { __ascendexMem?: Mem };
const mem: Mem = (g.__ascendexMem ??= { rules: new Map(), claims: [] as Claim[], profiles: new Map() });
mem.profiles ??= new Map();

const memoryStore: Store = {
  kind: "memory",
  async getRules(id) {
    return mem.rules.get(id) ?? null;
  },
  async setRules(id, rules) {
    mem.rules.set(id, rules);
    return rules;
  },
  async clearRules(id) {
    mem.rules.delete(id);
  },
  async createClaim(c) {
    const claim: Claim = { ...c, id: crypto.randomUUID(), code: newCode(), created_at: new Date().toISOString(), status: "claimed", redeemed_at: null };
    mem.claims.unshift(claim);
    if (mem.claims.length > 2000) mem.claims.length = 2000;
    return claim;
  },
  async redeem(code, merchantId) {
    const c = mem.claims.find((x) => x.code === code.trim().toUpperCase() && x.merchant_id === merchantId);
    if (!c || c.status !== "claimed") return null;
    c.status = "redeemed";
    c.redeemed_at = new Date().toISOString();
    return c;
  },
  async claimsForMerchant(id, limit = 50) {
    return mem.claims.filter((c) => c.merchant_id === id).slice(0, limit);
  },
  async claimsForCustomer(id, limit = 20) {
    return mem.claims.filter((c) => c.customer_id === id).slice(0, limit);
  },
  async claimsForUser(id, limit = 20) {
    return mem.claims.filter((c) => c.customer_user_id === id).slice(0, limit);
  },
  async getProfile(id) {
    return mem.profiles.get(id) ?? null;
  },
  async upsertProfile(id, patch) {
    const next = { ...(mem.profiles.get(id) ?? emptyProfile(id)), ...patch, id };
    mem.profiles.set(id, next);
    return next;
  },
  async ownerOf(merchantId) {
    for (const p of mem.profiles.values()) if (p.role === "merchant" && p.merchant_id === merchantId) return p.id;
    return null;
  },
  async ownedMerchantIds() {
    return [...mem.profiles.values()].filter((p) => p.role === "merchant" && p.merchant_id).map((p) => p.merchant_id!);
  },
};

// ── Supabase (PostgREST over fetch; secret key, server only) ───────────────
/**
 * New secret keys (sb_secret_...) go in the apikey header only; they are not JWTs
 * and are rejected as a Bearer token. Legacy service_role keys (JWTs, "eyJ...")
 * also need the Bearer header.
 */
export function supabaseHeaders(key: string): Record<string, string> {
  const h: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("eyJ")) h.authorization = `Bearer ${key}`;
  return h;
}

function supabaseStore(url: string, key: string): Store {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const headers = supabaseHeaders(key);
  async function call<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init.prefer ? { prefer: init.prefer } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text();
      if (body.includes("PGRST205")) throw new Error("Database tables are missing: run supabase/schema.sql in the Supabase SQL editor");
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 160)}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const enc = encodeURIComponent;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const toProfile = (r: Record<string, unknown>): Profile => ({
    ...emptyProfile(String(r.id)),
    ...r,
    lat: num(r.lat),
    lng: num(r.lng),
    interests: Array.isArray(r.interests) ? (r.interests as string[]) : [],
  }) as Profile;
  const toClaim = (r: Record<string, unknown>): Claim =>
    ({
      ...r,
      discount_pct: Number(r.discount_pct),
      base_price_inr: Number(r.base_price_inr),
      final_price_inr: Number(r.final_price_inr),
      unit_cost_inr: Number(r.unit_cost_inr),
      profit_estimate_inr: num(r.profit_estimate_inr),
    }) as Claim;
  return {
    kind: "supabase",
    async getRules(id) {
      const rows = await call<Record<string, unknown>[]>(`/merchant_rules?merchant_id=eq.${enc(id)}&select=*`);
      if (!rows[0]) return null;
      // Null columns mean "not overridden": keep only the fields the owner set.
      const rules: MerchantRules = {};
      for (const [k, v] of Object.entries(rows[0])) {
        if (v === null || ["merchant_id", "updated_at", "updated_by"].includes(k)) continue;
        (rules as Record<string, unknown>)[k] = typeof v === "string" && k !== "paused" ? Number(v) : v;
      }
      return rules;
    },
    async setRules(id, rules, by = null) {
      await call(`/merchant_rules?on_conflict=merchant_id`, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: JSON.stringify({ merchant_id: id, ...rules, updated_by: by, updated_at: new Date().toISOString() }),
      });
      return rules;
    },
    async clearRules(id) {
      await call(`/merchant_rules?merchant_id=eq.${enc(id)}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async createClaim(c) {
      const rows = await call<Record<string, unknown>[]>(`/claims`, {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({ ...c, code: newCode(), status: "claimed" }),
      });
      return toClaim(rows[0]);
    },
    async redeem(code, merchantId) {
      const rows = await call<Record<string, unknown>[]>(
        `/claims?code=eq.${enc(code.trim().toUpperCase())}&merchant_id=eq.${enc(merchantId)}&status=eq.claimed`,
        { method: "PATCH", prefer: "return=representation", body: JSON.stringify({ status: "redeemed", redeemed_at: new Date().toISOString() }) },
      );
      return rows[0] ? toClaim(rows[0]) : null;
    },
    async claimsForMerchant(id, limit = 50) {
      return (await call<Record<string, unknown>[]>(`/claims?merchant_id=eq.${enc(id)}&order=created_at.desc&limit=${limit}`)).map(toClaim);
    },
    async claimsForCustomer(id, limit = 20) {
      return (await call<Record<string, unknown>[]>(`/claims?customer_id=eq.${enc(id)}&order=created_at.desc&limit=${limit}`)).map(toClaim);
    },
    async claimsForUser(id, limit = 20) {
      return (await call<Record<string, unknown>[]>(`/claims?customer_user_id=eq.${enc(id)}&order=created_at.desc&limit=${limit}`)).map(toClaim);
    },
    async getProfile(id) {
      const rows = await call<Record<string, unknown>[]>(`/profiles?id=eq.${enc(id)}&select=*`);
      return rows[0] ? toProfile(rows[0]) : null;
    },
    async upsertProfile(id, patch) {
      const rows = await call<Record<string, unknown>[]>(`/profiles?on_conflict=id`, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({ id, ...patch, updated_at: new Date().toISOString() }),
      });
      return toProfile(rows[0]);
    },
    async ownerOf(merchantId) {
      const rows = await call<{ id: string }[]>(`/profiles?merchant_id=eq.${enc(merchantId)}&role=eq.merchant&select=id`);
      return rows[0]?.id ?? null;
    },
    async ownedMerchantIds() {
      const rows = await call<{ merchant_id: string }[]>(`/profiles?role=eq.merchant&merchant_id=not.is.null&select=merchant_id`);
      return rows.map((r) => r.merchant_id);
    },
  };
}

export function getStore(): Store {
  const { key } = secretKey();
  const url = process.env.SUPABASE_URL || SUPABASE_URL;
  return url && key ? supabaseStore(url, key) : memoryStore;
}

/** Why the database isn't in use, for health checks and UI notes. */
export const storeProblem = () => secretKey().problem;
