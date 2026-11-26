import { useEffect, useMemo, useRef, useState } from "react";
import type { Tree } from "../types";
import { loadSupabase } from "../auth/client";
import type { SyncStatus } from "./useCloudSync";
import { computeRatings, levelStepOf, type Mastery, type Ratings } from "./ratings";
import { fetchSnapshots, loadSnapshots, mergeSnapshots, pushSnapshots, recordWeek, sameSnapshots, saveSnapshots, type RatingSnapshot } from "./ratingHistory";

export interface RatingsState {
  /** The ratings right now, worked out from the finished skills, level and mastery. */
  ratings: Ratings;
  /** One snapshot per week, oldest first, for the career page. */
  history: RatingSnapshot[];
}

/**
 * The player's ratings (#123) and their weekly history. The ratings are worked out from progress each time;
 * this week's snapshot is kept up to date in this browser and, when signed in, merged with the account's history
 * and saved to it. While the account's progress is still loading nothing is recorded, because the finished skills
 * are not final yet. If the calls fail (offline, or migration 008 not run yet) the app carries on with this
 * browser's copy.
 */
export function useRatings(
  tree: Tree,
  userId: string | null,
  status: SyncStatus,
  done: Set<string>,
  levelId: string | null,
  step: number,
  today: string,
  mastery?: Record<string, Mastery>,
): RatingsState {
  const ratings = useMemo(() => computeRatings({ tree, done, levelStep: levelStepOf(tree, levelId, step), mastery }), [tree, done, levelId, step, mastery]);
  const [history, setHistory] = useState<RatingSnapshot[]>(() => loadSnapshots(tree.id));
  const accountReady = useRef<string | null>(null);
  const latest = useRef({ history, ratings, today });
  latest.current = { history, ratings, today };

  // Keep this week's snapshot up to date, once the progress is final.
  useEffect(() => {
    if (status === "loading") return;
    setHistory((current) => recordWeek(current, today, ratings, new Date().toISOString()));
  }, [status, today, ratings]);

  useEffect(() => saveSnapshots(tree.id, history), [tree.id, history]);

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
        const { history: mine, ratings: now, today: day } = latest.current;
        const merged = recordWeek(mergeSnapshots(await fetchSnapshots(client, tree.id), mine), day, now, new Date().toISOString());
        if (!active) return;
        accountReady.current = userId;
        setHistory((current) => (sameSnapshots(current, merged) ? current : mergeSnapshots(current, merged)));
        await pushSnapshots(client, tree.id, merged);
      })
      .catch((e: unknown) => console.warn("Rating history sync failed", e));
    return () => {
      active = false;
    };
  }, [tree, userId, status]);

  // Send later changes, a moment after the last one.
  useEffect(() => {
    if (!userId || status !== "ready" || accountReady.current !== userId) return;
    const timer = window.setTimeout(() => {
      loadSupabase()
        .then((client) => (client ? pushSnapshots(client, tree.id, latest.current.history) : undefined))
        .catch((e: unknown) => console.warn("Rating history save failed", e));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [tree, userId, status, history]);

  return { ratings, history };
}
