"use client";

import { useCallback, useEffect, useState } from "react";

export type Me = {
  login: boolean;
  store: "supabase" | "memory";
  saved: boolean;
  user: { id: string; name: string | null; avatar_url: string | null } | null;
  profile: {
    role: "customer" | "merchant" | null;
    display_name: string | null;
    merchant_id: string | null;
    locality: string | null;
    language: string;
    interests: string[];
    marketing_consent: boolean;
  } | null;
  shop: { id: string; name: string; category: string; locality: string } | null;
  taken_merchant_ids: string[];
};

// One request per page load, shared by every component that asks.
let cached: Promise<Me | null> | null = null;
const load = () =>
  (cached ??= fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .catch(() => null));

export function useViewer() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    load().then((m) => {
      if (!live) return;
      setMe(m);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    cached = null;
    const m = await load();
    setMe(m);
    return m;
  }, []);
  return { me, ready, refresh };
}
