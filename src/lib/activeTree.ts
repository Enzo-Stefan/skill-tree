import type { Tree } from "../types";
import { levelInfo, loadProgress } from "./progress";

// Which tree the player is training on (Football, Strength, ...), remembered in this browser.
//
// Everything else is already kept per tree: finished skills, level and step, training days,
// streak, the lift log and the account sync (one row per tree). So switching trees only needs
// to remember the choice and show that tree. Each tree keeps its own progress.

const ACTIVE_KEY = "skill-tree:active-tree";

/** The tree with this id, or the first tree if there's none (an old or broken choice). */
export function findTree(trees: Tree[], id: string | null): Tree {
  return trees.find((t) => t.id === id) ?? trees[0];
}

/** The tree the player last chose in this browser, or the first tree. */
export function activeTree(trees: Tree[]): Tree {
  try {
    return findTree(trees, localStorage.getItem(ACTIVE_KEY));
  } catch {
    return trees[0];
  }
}

export function saveActiveTree(treeId: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, treeId);
  } catch {
    // Storage can be blocked. Then the app opens on the first tree next time.
  }
}

/**
 * Switches to another tree. The choice is saved and the page reloads, so every part of the app
 * starts fresh with the new tree's progress. Nothing is lost: progress is saved in the browser as
 * it changes, and any change not yet saved to the account is marked and merged on the next load.
 *
 * Returns:
 *   False if the tree doesn't exist or is already the active one, so nothing happened.
 */
export function switchTree(trees: Tree[], current: Tree, treeId: string, reload: () => void = () => window.location.reload()): boolean {
  if (treeId === current.id || !trees.some((t) => t.id === treeId)) return false;
  saveActiveTree(treeId);
  reload();
  return true;
}

/** What a tree picker shows for each tree: name, how far the player is, and which one is open. */
export interface TreeSummary {
  id: string;
  title: string;
  tagline: string;
  done: number;
  total: number;
  /** The player's rank in that tree, e.g. "Academy". */
  rank: string;
  active: boolean;
}

export function treeSummaries(trees: Tree[], current: Tree): TreeSummary[] {
  return trees.map((tree) => {
    const ids = new Set(tree.skills.map((s) => s.id));
    const done = [...loadProgress(tree.id)].filter((id) => ids.has(id)).length;
    return {
      id: tree.id,
      title: tree.title,
      tagline: tree.tagline,
      done,
      total: tree.skills.length,
      rank: levelInfo(tree.levels, done).current.name,
      active: tree.id === current.id,
    };
  });
}
