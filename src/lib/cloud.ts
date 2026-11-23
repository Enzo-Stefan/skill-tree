import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";

// Saving progress to a player's account. The table and its security rules live in
// supabase/migrations/001_progress.sql. The Supabase client itself comes from
// src/auth/ (Enzo's side), so there is only ever one client.

/** Everything we keep per player per tree. Mirrors one row of the progress table. */
export interface SavedProgress {
  done: string[];
  playerLevel: string | null;
  /** Step within the level, 1 to 4 (Beginner 1 ... Expert 4). */
  playerStep: number;
  /** Days the player checked in "I trained today", as YYYY-MM-DD. */
  practiceDays: string[];
  /** Streak bookkeeping from src/lib/streak.ts. Both are week-start dates (Mondays) or null. */
  streak: { since: string | null; askedWeek: string | null };
}

const TABLE = "progress";

interface Row {
  done: string[] | null;
  player_level: string | null;
  player_step: number | null;
  practice_days: string[] | null;
  streak_since: string | null;
  streak_asked_week: string | null;
}

/** True for a real calendar date written YYYY-MM-DD. "2026-02-31" is rejected, which the database would refuse. */
export function isRealDay(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, day));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === day;
}
const dayOrNull = (d: string | null) => (d !== null && isRealDay(d) ? d : null);

/** Drop anything the tree no longer has (a renamed skill, a removed level), so old saves can't break the app. */
export function cleanProgress(tree: Tree, p: SavedProgress): SavedProgress {
  const ids = new Set(tree.skills.map((s) => s.id));
  const done = [...new Set(p.done)].filter((id) => ids.has(id));
  const levelOk = p.playerLevel !== null && (tree.playerLevels ?? []).some((l) => l.id === p.playerLevel);
  const practiceDays = [...new Set(p.practiceDays)].filter(isRealDay).sort();
  return {
    done,
    playerLevel: levelOk ? p.playerLevel : null,
    playerStep: levelOk && Number.isInteger(p.playerStep) && p.playerStep >= 1 && p.playerStep <= 4 ? p.playerStep : 1,
    practiceDays,
    // A streak only means something next to a level, so it goes when the level does.
    streak: levelOk
      ? { since: dayOrNull(p.streak.since), askedWeek: dayOrNull(p.streak.askedWeek) }
      : { since: null, askedWeek: null },
  };
}

/**
 * Combine this browser's progress with the account's the first time a player signs in here.
 * Finished skills and training days from both are kept, so nothing is lost. If the account
 * already has a level, it wins over the browser's (with its streak), because it was chosen first.
 */
export function mergeProgress(tree: Tree, local: SavedProgress, cloud: SavedProgress | null): SavedProgress {
  const l = cleanProgress(tree, local);
  if (!cloud) return l;
  const c = cleanProgress(tree, cloud);
  const done = [...new Set([...c.done, ...l.done])];
  const practiceDays = [...new Set([...c.practiceDays, ...l.practiceDays])].sort();
  const fromCloud = c.playerLevel !== null;
  return {
    done,
    playerLevel: fromCloud ? c.playerLevel : l.playerLevel,
    playerStep: fromCloud ? c.playerStep : l.playerStep,
    practiceDays,
    streak: fromCloud ? c.streak : l.streak,
  };
}

/** The account's saved progress for a tree, or null if they have never saved it. */
export async function fetchCloudProgress(
  client: SupabaseClient,
  userId: string,
  treeId: string,
): Promise<SavedProgress | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("done, player_level, player_step, practice_days, streak_since, streak_asked_week")
    .eq("user_id", userId)
    .eq("tree_id", treeId)
    .maybeSingle<Row>();
  if (error) throw new Error(`Couldn't load your saved progress: ${error.message}`);
  if (!data) return null;
  return {
    done: data.done ?? [],
    playerLevel: data.player_level,
    playerStep: data.player_step ?? 1,
    practiceDays: data.practice_days ?? [],
    streak: { since: data.streak_since, askedWeek: data.streak_asked_week },
  };
}

export async function saveCloudProgress(
  client: SupabaseClient,
  userId: string,
  treeId: string,
  p: SavedProgress,
): Promise<void> {
  const { error } = await client.from(TABLE).upsert(
    {
      user_id: userId,
      tree_id: treeId,
      done: p.done,
      player_level: p.playerLevel,
      player_step: p.playerStep,
      practice_days: p.practiceDays,
      streak_since: p.streak.since,
      streak_asked_week: p.streak.askedWeek,
    },
    { onConflict: "user_id,tree_id" },
  );
  if (error) throw new Error(`Couldn't save your progress: ${error.message}`);
}

/**
 * Run once right after a player signs in. Loads the account's progress, merges in this
 * browser's, saves the result back and returns it for the app to show.
 */
export async function syncOnSignIn(
  client: SupabaseClient,
  userId: string,
  tree: Tree,
  local: SavedProgress,
): Promise<SavedProgress> {
  const cloud = await fetchCloudProgress(client, userId, tree.id);
  const merged = mergeProgress(tree, local, cloud);
  await saveCloudProgress(client, userId, tree.id, merged);
  return merged;
}

/**
 * Saves progress a moment after the last change, so ticking off three skills
 * quickly sends one request instead of three. Call flush() before signing out.
 */
export function createCloudSaver(
  client: SupabaseClient,
  userId: string,
  treeId: string,
  onError: (message: string) => void,
  delayMs = 800,
) {
  let pending: SavedProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Saves run one at a time. Each save sends the whole snapshot, so if two overlapped and the
  // older one finished last, it would overwrite newer progress.
  let inFlight: Promise<void> = Promise.resolve();

  function flush(): Promise<void> {
    clearTimeout(timer);
    inFlight = inFlight.then(async () => {
      // Read pending only when it's this save's turn, so it always sends the latest progress.
      if (!pending) return;
      const p = pending;
      pending = null;
      try {
        await saveCloudProgress(client, userId, treeId, p);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Couldn't save your progress.");
      }
    });
    return inFlight;
  }

  function save(p: SavedProgress): void {
    pending = p;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), delayMs);
  }

  return { save, flush };
}
