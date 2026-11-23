import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";

// Saving progress to a player's account. The table and its security rules live in
// supabase/migrations/001_progress.sql. The Supabase client itself comes from
// src/auth/ (Enzo's side), so there is only ever one client.

/** Everything we keep per player per tree. Mirrors one row of the progress table. */
export interface SavedProgress {
  done: string[];
  playerLevel: string | null;
  /** Finished-skill count when the player last picked a level or said "not yet". */
  levelCheckpoint: number | null;
}

const TABLE = "progress";

interface Row {
  done: string[] | null;
  player_level: string | null;
  level_checkpoint: number | null;
}

/** Drop anything the tree no longer has (a renamed skill, a removed level), so old saves can't break the app. */
export function cleanProgress(tree: Tree, p: SavedProgress): SavedProgress {
  const ids = new Set(tree.skills.map((s) => s.id));
  const done = [...new Set(p.done)].filter((id) => ids.has(id));
  const levelOk = p.playerLevel !== null && (tree.playerLevels ?? []).some((l) => l.id === p.playerLevel);
  const checkpoint =
    p.levelCheckpoint !== null && Number.isInteger(p.levelCheckpoint) && p.levelCheckpoint >= 0
      ? Math.min(p.levelCheckpoint, done.length)
      : null;
  return { done, playerLevel: levelOk ? p.playerLevel : null, levelCheckpoint: levelOk ? checkpoint : null };
}

/**
 * Combine this browser's progress with the account's the first time a player signs in here.
 * Finished skills from both are kept, so nothing is lost. If the account already has a level,
 * it wins over the browser's, because it was chosen first.
 */
export function mergeProgress(tree: Tree, local: SavedProgress, cloud: SavedProgress | null): SavedProgress {
  const l = cleanProgress(tree, local);
  if (!cloud) return l;
  const c = cleanProgress(tree, cloud);
  const done = [...new Set([...c.done, ...l.done])];
  const fromCloud = c.playerLevel !== null;
  return {
    done,
    playerLevel: fromCloud ? c.playerLevel : l.playerLevel,
    levelCheckpoint: fromCloud ? c.levelCheckpoint : l.levelCheckpoint,
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
    .select("done, player_level, level_checkpoint")
    .eq("user_id", userId)
    .eq("tree_id", treeId)
    .maybeSingle<Row>();
  if (error) throw new Error(`Couldn't load your saved progress: ${error.message}`);
  if (!data) return null;
  return { done: data.done ?? [], playerLevel: data.player_level, levelCheckpoint: data.level_checkpoint };
}

export async function saveCloudProgress(
  client: SupabaseClient,
  userId: string,
  treeId: string,
  p: SavedProgress,
): Promise<void> {
  const { error } = await client.from(TABLE).upsert(
    { user_id: userId, tree_id: treeId, done: p.done, player_level: p.playerLevel, level_checkpoint: p.levelCheckpoint },
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

  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (!pending) return;
    const p = pending;
    pending = null;
    try {
      await saveCloudProgress(client, userId, treeId, p);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save your progress.");
    }
  }

  function save(p: SavedProgress): void {
    pending = p;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), delayMs);
  }

  return { save, flush };
}
