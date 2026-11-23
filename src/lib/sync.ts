import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";
import { cleanProgress, fetchCloudProgress, saveCloudProgress, syncOnSignIn, type SavedProgress } from "./cloud";

// When a signed-in player opens the app, which copy of their progress wins.
//
// The first time an account is used in a browser, the browser's progress and the account's are
// merged, so nothing done before signing in is lost. After that the account's copy wins on every
// load: merging again would bring back a skill that was un-ticked on another device.

const syncedKey = (treeId: string) => `skill-tree:${treeId}:synced-account`;

/** True once this account's progress has been merged into this browser for this tree. */
export function isSyncedHere(treeId: string, userId: string): boolean {
  try {
    return localStorage.getItem(syncedKey(treeId)) === userId;
  } catch {
    return false;
  }
}

export function markSyncedHere(treeId: string, userId: string): void {
  try {
    localStorage.setItem(syncedKey(treeId), userId);
  } catch {
    // Storage can be blocked. Then the next load merges again, which loses nothing.
  }
}

/**
 * The progress to show for a signed-in player.
 *
 * Args:
 *   firstHere: True if this account hasn't been synced in this browser before.
 *
 * Returns:
 *   First time here: the browser and account merged, and saved to the account.
 *   After that: the account's copy. If the account has no saved row (for example it was
 *   deleted), the browser's progress is saved to it instead.
 */
export async function loadAccountProgress(
  client: SupabaseClient,
  userId: string,
  tree: Tree,
  local: SavedProgress,
  firstHere: boolean,
): Promise<SavedProgress> {
  if (firstHere) return syncOnSignIn(client, userId, tree, local);
  const cloud = await fetchCloudProgress(client, userId, tree.id);
  if (cloud) return cleanProgress(tree, cloud);
  const cleaned = cleanProgress(tree, local);
  await saveCloudProgress(client, userId, tree.id, cleaned);
  return cleaned;
}

/** Same progress, ignoring the order of finished skills and training days. */
export function sameProgress(a: SavedProgress, b: SavedProgress): boolean {
  const key = (p: SavedProgress) =>
    JSON.stringify({ ...p, done: [...p.done].sort(), practiceDays: [...p.practiceDays].sort() });
  return key(a) === key(b);
}
