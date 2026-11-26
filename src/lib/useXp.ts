import { useEffect, useMemo, useRef, useState } from "react";
import type { Tree } from "../types";
import { loadSupabase } from "../auth/client";
import type { SyncStatus } from "./useCloudSync";
import { mergeEvents, totalXp, xpLevel, type XpEvent, type XpLevel } from "./xp";
import { fetchXp, loadXp, pushXp, reconcile, saveXp, sameEvents } from "./xpSync";

export interface XpState {
  events: XpEvent[];
  total: number;
  level: XpLevel;
}

/**
 * The player's XP. It follows the finished skills and training days (reconcile), is kept in this browser, and
 * when signed in is merged with the account's ledger and saved to it. While the account's progress is still
 * loading nothing is awarded or taken away, because the finished skills are not final yet. If the XP calls
 * fail (offline, or migration 007 not run yet) the app carries on with this browser's copy.
 */
export function useXp(tree: Tree, userId: string | null, status: SyncStatus, done: Set<string>, practiceDays: string[]): XpState {
  const [events, setEvents] = useState<XpEvent[]>(() => loadXp(tree.id));
  const accountReady = useRef<string | null>(null);
  const latest = useRef({ events, done, practiceDays });
  latest.current = { events, done, practiceDays };

  // Follow the finished skills and training days, once they are final.
  useEffect(() => {
    if (status === "loading") return;
    setEvents((current) => reconcile(tree, current, done, practiceDays, new Date().toISOString()));
  }, [tree, status, done, practiceDays]);

  useEffect(() => saveXp(tree.id, events), [tree.id, events]);

  // Merge with the account when progress has loaded, then send every change.
  useEffect(() => {
    if (!userId || status !== "ready") {
      accountReady.current = null;
      return;
    }
    let active = true;
    loadSupabase()
      .then(async (client) => {
        if (!client || !active) return;
        const merged = mergeEvents(await fetchXp(client, tree.id), latest.current.events);
        const now = reconcile(tree, merged, latest.current.done, latest.current.practiceDays, new Date().toISOString());
        if (!active) return;
        accountReady.current = userId;
        const next = mergeEvents(now, latest.current.events);
        setEvents((current) => (sameEvents(current, next) ? current : mergeEvents(current, next)));
        await pushXp(client, tree.id, now);
      })
      .catch((e: unknown) => console.warn("XP sync failed", e));
    return () => {
      active = false;
    };
  }, [tree, userId, status]);

  // Send later changes, a moment after the last one.
  useEffect(() => {
    if (!userId || status !== "ready" || accountReady.current !== userId) return;
    const timer = window.setTimeout(() => {
      loadSupabase()
        .then((client) => (client ? pushXp(client, tree.id, latest.current.events) : undefined))
        .catch((e: unknown) => console.warn("XP save failed", e));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [tree, userId, status, events]);

  return useMemo(() => {
    const total = totalXp(events);
    return { events, total, level: xpLevel(total) };
  }, [events]);
}
