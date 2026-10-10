"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Calls `onChange` the moment a row in `table` matching `filter` changes, via
 * Supabase Realtime. Row-level security decides what a signed-in user receives,
 * so a customer only hears about their own claims and a shop only about its own.
 * Returns whether the channel is live; callers keep polling as a fallback.
 */
export function useRealtime(table: string, filter: string | null, onChange: () => void): boolean {
  const [live, setLive] = useState(false);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase || !filter) return;
    const channel = supabase
      .channel(`${table}:${filter}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => cb.current())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [table, filter]);

  return live;
}
