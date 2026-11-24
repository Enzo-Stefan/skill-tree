import { completedDependents } from "../lib/progress";
import type { Skill, Tree } from "../types";

/** A copy of `done` without `id`. */
export function withoutSkill(done: Set<string>, id: string): Set<string> {
  const next = new Set(done);
  next.delete(id);
  return next;
}

/**
 * What the toast's Undo does to a passed skill. If a skill that needs it has been passed since
 * (a cloud load can land during the Undo window), nothing changes and `blockers` lists those
 * skills, so the player is told to undo them first.
 */
export function undoPass(tree: Tree, done: Set<string>, id: string): { done: Set<string>; blockers: Skill[] } {
  const blockers = completedDependents(tree, done, id);
  return blockers.length ? { done, blockers } : { done: withoutSkill(done, id), blockers };
}
