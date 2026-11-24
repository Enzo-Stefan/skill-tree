import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";
import { cleanProgress, fetchCloudProgress, saveCloudProgress, syncOnSignIn, type SavedProgress } from "./cloud";
import { replayLiftLog } from "./lifts";

// When a signed-in player opens the app, which copy of their progress wins.
//
// The account's copy wins, so a skill un-ticked on another device doesn't come back, unless
// this browser may have progress the account doesn't. Then the two are merged, so nothing is
// lost. That's the case when:
//   - this account has never been synced in this browser, or
//   - the browser has unsaved changes: progress changed and no save of it has succeeded yet.
//     That covers training offline, a save that failed, using the app signed out, and
//     closing the app while the account was still loading.
//     If this browser kept a copy of what the account last held, only the changes made here
//     since then are applied to the account's copy, so removals stick (rebaseProgress).
//     Without that copy, everything from both is kept (mergeProgress).

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

const accountCopyKey = (treeId: string) => `skill-tree:${treeId}:account-copy`;

/**
 * The progress this account had the last time this browser loaded or saved it, or null if
 * there is none for this account. Changes since then are what this browser did on its own.
 */
export function loadAccountCopy(treeId: string, userId: string): SavedProgress | null {
  try {
    const raw = localStorage.getItem(accountCopyKey(treeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown; progress?: SavedProgress };
    const p = parsed.progress;
    if (parsed.userId !== userId || !p || !Array.isArray(p.done) || !Array.isArray(p.practiceDays) || !p.streak) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveAccountCopy(treeId: string, userId: string, p: SavedProgress): void {
  try {
    localStorage.setItem(accountCopyKey(treeId), JSON.stringify({ userId, progress: p }));
  } catch {
    // Storage can be blocked. Then the next merge keeps everything from both copies, which loses nothing.
  }
}

/**
 * Apply what this browser changed since `base` on top of the account's copy.
 *
 * Unlike mergeProgress, skills and training days removed here since `base` stay removed, so an
 * un-tick or a reset made offline sticks, while changes from other devices are kept. If the
 * level, step or streak changed here, all three come from this browser (they belong together);
 * otherwise from the account. Lift log entries work like skills: logged here is added, undone or
 * reset here is removed, and entries from other devices stay.
 */
export function rebaseProgress(tree: Tree, account: SavedProgress | null, base: SavedProgress, local: SavedProgress): SavedProgress {
  const l = cleanProgress(tree, local);
  if (!account) return l;
  const a = cleanProgress(tree, account);
  const b = cleanProgress(tree, base);
  const replay = (onto: string[], from: string[], to: string[]) => {
    const before = new Set(from);
    const after = new Set(to);
    const out = new Set(onto);
    for (const x of to) if (!before.has(x)) out.add(x);
    for (const x of from) if (!after.has(x)) out.delete(x);
    return [...out];
  };
  const rungChanged =
    l.playerLevel !== b.playerLevel ||
    l.playerStep !== b.playerStep ||
    l.streak.since !== b.streak.since ||
    l.streak.askedWeek !== b.streak.askedWeek;
  const rung = rungChanged ? l : a;
  return {
    done: replay(a.done, b.done, l.done),
    playerLevel: rung.playerLevel,
    playerStep: rung.playerStep,
    practiceDays: replay(a.practiceDays, b.practiceDays, l.practiceDays).sort(),
    streak: rung.streak,
    liftLog: replayLiftLog(tree, a.liftLog ?? [], b.liftLog ?? [], l.liftLog ?? []),
  };
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
 *   base: The account's copy as this browser last saw it (loadAccountCopy), or null.
 *
 * Returns:
 *   With merge and a base: this browser's changes since the base applied to the account's
 *   copy (rebaseProgress), and saved to the account.
 *   With merge and no base: the browser and account merged, keeping everything from both,
 *   and saved to the account.
 *   Without merge: the account's copy. If the account has no saved row (for example it was
 *   deleted), the browser's progress is saved to it instead.
 */
export async function loadAccountProgress(
  client: SupabaseClient,
  userId: string,
  tree: Tree,
  local: SavedProgress,
  merge: boolean,
  base: SavedProgress | null = null,
): Promise<SavedProgress> {
  if (merge && base) {
    const cloud = await fetchCloudProgress(client, userId, tree.id);
    const rebased = rebaseProgress(tree, cloud, base, local);
    await saveCloudProgress(client, userId, tree.id, rebased);
    return rebased;
  }
  if (merge) return syncOnSignIn(client, userId, tree, local);
  const cloud = await fetchCloudProgress(client, userId, tree.id);
  if (cloud) return cleanProgress(tree, cloud);
  const cleaned = cleanProgress(tree, local);
  await saveCloudProgress(client, userId, tree.id, cleaned);
  return cleaned;
}

/** Same progress, ignoring the order of finished skills, training days and lift entries. A missing lift log is an empty one. */
export function sameProgress(a: SavedProgress, b: SavedProgress): boolean {
  const key = (p: SavedProgress) =>
    JSON.stringify({
      ...p,
      done: [...p.done].sort(),
      practiceDays: [...p.practiceDays].sort(),
      liftLog: (p.liftLog ?? []).map((e) => `${e.skillId}|${e.date}|${e.kg}`).sort(),
    });
  return key(a) === key(b);
}
