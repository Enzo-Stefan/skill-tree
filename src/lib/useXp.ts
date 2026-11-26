import { useEffect, useMemo, useRef, useState } from "react";
import type { Tree } from "../types";
import { loadSupabase } from "../auth/client";
import type { SyncStatus } from "./useCloudSync";
import { mergeEvents, totalXp, xpLevel, type XpEvent, type XpLevel } from "./xp";
import { applyAchievements, earnedAchievements, earnedInLedger } from "./achievements";
import { fetchXp, loadXp, pushXp, reconcile, saveXp, sameEvents } from "./xpSync";

export interface XpState {
  events: XpEvent[];
  total: number;
  level: XpLevel;
  /** Ids of the achievements earned (#121 item 4), from the ledger, so trophies from another device count too. */
  earned: string[];
}

/** What the achievement rules need beyond the finished skills and training days. */
export interface XpExtra {
  streakWeeks: number;
  /** -1 none picked, 0 Beginner ... 3 Expert. */
  levelIndex: number;
  results: number;
}

/** Reconcile the ledger with progress, then add any achievement now earned. */
function follow(tree: Tree, current: XpEvent[], done: Set<string>, practiceDays: string[], extra: XpExtra, now: string): XpEvent[] {
  const synced = reconcile(tree, current, done, practiceDays, now);
  return applyAchievements(synced, earnedAchievements({ tree, done, practiceDays, ...extra }), now);
}

/**
 * The player's XP. It follows the finished skills and training days (reconcile), is kept in this browser, and
 * when signed in is merged with the account's ledger and saved to it. While the account's progress is still
 * loading nothing is awarded or taken away, because the finished skills are not final yet. If the XP calls
 * fail (offline, or migration 007 not run yet) the app carries on with this browser's copy.
 */
export function useXp(tree: Tree, userId: string | null, status: SyncStatus, done: Set<string>, practiceDays: string[], extra: XpExtra = { streakWeeks: 0, levelIndex: -1, results: 0 }): XpState {
  const [events, setEvents] = useState<XpEvent[]>(() => loadXp(tree.id));
  const accountReady = useRef<string | null>(null);
  const { streakWeeks, levelIndex, results } = extra;
  const latest = useRef({ events, done, practiceDays, extra });
  latest.current = { events, done, practiceDays, extra };


  // Follow the finished skills and training days, once they are final.
  useEffect(() => {
    if (status === "loading") return;
    setEvents((current) => follow(tree, current, done, practiceDays, { streakWeeks, levelIndex, results }, new Date().toISOString()));
  }, [tree, status, done, practiceDays, streakWeeks, levelIndex, results]);

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
        const now = follow(tree, merged, latest.current.done, latest.current.practiceDays, latest.current.extra, new Date().toISOString());
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
    return { events, total, level: xpLevel(total), earned: earnedInLedger(events) };
  }, [events]);
}
