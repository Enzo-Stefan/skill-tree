import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Tree } from "../types";
import { loadSupabase } from "../auth/client";
import type { SyncStatus } from "./useCloudSync";
import { award, mergeEvents, passDayKey, revoke, skillPassKey, totalXp, xpLevel, type XpEvent, type XpLevel } from "./xp";
import { belongsToAnother, setOwner } from "./localOwner";
import { applyStreakRewards } from "./streakRewards";
import { backfillBronze, recordPass, recordRetest, tiersOf, type RetestResult } from "./mastery";
import type { MasteryTier } from "./xp";
import { applyChallengeRewards, applyMissionRewards } from "./challengeRewards";
import type { SessionEntry } from "./sessions";
import { applyAchievements, earnedAchievements, earnedInLedger } from "./achievements";
import { fetchXp, loadXp, pushXp, reconcile, saveXp, sameEvents } from "./xpSync";

export interface XpState {
  events: XpEvent[];
  total: number;
  level: XpLevel;
  /** Switches every award off, for "Reset everything": XP, trophies and streak bonuses start again from the reset progress. */
  reset: () => void;
  /** A skill was just passed on this day: remembers the day of its first-ever pass, so challenges count only passes made from now on. */
  recordPassDay: (skillId: string, day: string) => void;
  /** The highest mastery tier of each passed skill (#121 item 5). */
  mastery: Record<string, MasteryTier>;
  /** A skill was just passed at this level step (1 to 16, 0 with no level): earns bronze and remembers the step. */
  recordPass: (skillId: string, step: number) => void;
  /** A test passed again at this level step: earns the next tier if the step is a full level above the last one. */
  retest: (skillId: string, step: number) => RetestResult;
  /** Ids of the achievements earned (#121 item 4), from the ledger, so trophies from another device count too. */
  earned: string[];
}

/** What the achievement rules need beyond the finished skills and training days. */
export interface XpExtra {
  streakWeeks: number;
  /** The week the current streak started after (src/lib/streak.ts `since`), or null for the first run. */
  streakSince?: string | null;
  /** -1 none picked, 0 Beginner ... 3 Expert. */
  levelIndex: number;
  results: number;
  /** Which skills were worked on which day, for the challenges. */
  sessions?: SessionEntry[];
  /** Today, as YYYY-MM-DD, for the challenges. Without it no challenge is checked. */
  today?: string;
  /** The mission award keys completed today (completedMissionKeys). */
  missionKeys?: string[];
}

/** Reconcile the ledger with progress, then add any achievement now earned. */
function follow(tree: Tree, current: XpEvent[], done: Set<string>, practiceDays: string[], extra: XpExtra, now: string): XpEvent[] {
  const synced = backfillBronze(reconcile(tree, current, done, practiceDays, now), done, now);
  const withTrophies = applyAchievements(synced, earnedAchievements({ tree, done, practiceDays, ...extra }), now);
  const withStreak = applyStreakRewards(withTrophies, extra.streakWeeks, extra.streakSince ?? null, now);
  const withMissions = applyMissionRewards(withStreak, extra.missionKeys ?? [], now);
  return extra.today ? applyChallengeRewards(withMissions, { practiceDays, sessions: extra.sessions ?? [], today: extra.today }, now) : withMissions;
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
  const { streakWeeks, streakSince = null, levelIndex, results, sessions, today, missionKeys } = extra;
  const latest = useRef({ events, done, practiceDays, extra });
  latest.current = { events, done, practiceDays, extra };


  // Follow the finished skills and training days, once they are final.
  useEffect(() => {
    if (status === "loading") return;
    setEvents((current) => follow(tree, current, done, practiceDays, { streakWeeks, streakSince, levelIndex, results, sessions, today, missionKeys }, new Date().toISOString()));
  }, [tree, status, done, practiceDays, streakWeeks, streakSince, levelIndex, results, sessions, today, missionKeys]);

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
        // Another account's XP left in this browser (#139) is not this player's: start from the account's own.
        const foreign = belongsToAnother(tree.id, "xp", userId);
        const merged = mergeEvents(await fetchXp(client, tree.id), foreign ? [] : latest.current.events);
        const now = follow(tree, merged, latest.current.done, latest.current.practiceDays, latest.current.extra, new Date().toISOString());
        if (!active) return;
        accountReady.current = userId;
        setOwner(tree.id, "xp", userId);
        if (foreign) setEvents(now);
        else {
          const next = mergeEvents(now, latest.current.events);
          setEvents((current) => (sameEvents(current, next) ? current : mergeEvents(current, next)));
        }
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

  // Reset everything: every active award is switched off (not deleted), so the account's copy follows, and a new
  // streak after the reset can earn its bonuses again.
  const reset = useCallback(() => {
    const now = new Date().toISOString();
    setEvents((current) => current.reduce((next, e) => (e.active ? revoke(next, e.key, now) : next), current));
  }, []);

  // Only a skill's first-ever pass gets a day. A skill-pass event is switched off by an undo, never deleted, so its
  // existence says the skill was passed before: an undo and re-pass (of a new or an old skill) must not move the pass
  // to today, or a pass goal could be met every day by undoing and passing again.
  const recordPassDay = useCallback((skillId: string, day: string) => {
    setEvents((current) =>
      current.some((e) => e.key === skillPassKey(skillId)) ? current : award(current, passDayKey(skillId, day), 0, new Date().toISOString()),
    );
  }, []);

  const recordPassNow = useCallback((skillId: string, step: number) => {
    setEvents((current) => recordPass(current, skillId, step, new Date().toISOString()));
  }, []);

  const retest = useCallback((skillId: string, step: number): RetestResult => {
    const outcome = recordRetest(latest.current.events, skillId, step, new Date().toISOString());
    if (outcome.events !== latest.current.events) setEvents(outcome.events);
    return outcome.result;
  }, []);

  return useMemo(() => {
    const total = totalXp(events);
    return { events, total, level: xpLevel(total), earned: earnedInLedger(events), reset, recordPassDay, mastery: tiersOf(events), recordPass: recordPassNow, retest };
  }, [events, reset, recordPassDay, recordPassNow, retest]);
}
