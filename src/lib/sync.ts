import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";
import { cleanProgress, fetchCloudProgress, saveCloudProgress, syncOnSignIn, type SavedProgress } from "./cloud";

// When a signed-in player opens the app, which copy of their progress wins.
//
// The account's copy wins, so a skill un-ticked on another device doesn't come back, unless
// this browser may have progress the account doesn't. Then the two are merged, so nothing is
// lost. That's the case when:
//   - this account has never been synced in this browser, or
//   - the browser has unsaved changes: progress changed and no save of it has succeeded yet.
//     That covers training offline, a save that failed, using the app signed out, and
//     closing the app while the account was still loading.

const syncedKey = (treeId: string) => `skill-tree:${treeId}:synced-account`;
const unsavedKey = (treeId: string) => `skill-tree:${treeId}:unsaved`;

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

/** True if progress changed in this browser and no save of it has succeeded yet. */
export function hasUnsavedChanges(treeId: string): boolean {
  try {
    return localStorage.getItem(unsavedKey(treeId)) === "1";
  } catch {
    // Can't tell, so merge to be safe.
    return true;
  }
}

export function setUnsavedChanges(treeId: string, unsaved: boolean): void {
  try {
    if (unsaved) localStorage.setItem(unsavedKey(treeId), "1");
    else localStorage.removeItem(unsavedKey(treeId));
  } catch {
    // Storage can be blocked. hasUnsavedChanges() then says true, which merges and loses nothing.
  }
}

/** Whether the next load should merge this browser's progress into the account. */
export function shouldMerge(treeId: string, userId: string): boolean {
  return !isSyncedHere(treeId, userId) || hasUnsavedChanges(treeId);
}

/**
 * The progress to show for a signed-in player.
 *
 * Args:
 *   merge: True if this browser may have progress the account doesn't (see shouldMerge).
 *
 * Returns:
 *   With merge: the browser and account merged, and saved to the account.
 *   Without: the account's copy. If the account has no saved row (for example it was
 *   deleted), the browser's progress is saved to it instead.
 */
export async function loadAccountProgress(
  client: SupabaseClient,
  userId: string,
  tree: Tree,
  local: SavedProgress,
  merge: boolean,
): Promise<SavedProgress> {
  if (merge) return syncOnSignIn(client, userId, tree, local);
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
