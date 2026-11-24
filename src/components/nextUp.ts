import type { Skill, Tree } from "../types";
import { skillState } from "../lib/progress";

/** Skills in the order they unlock: by tier, then left to right. */
export function inUnlockOrder(skills: Skill[]): Skill[] {
  return [...skills].sort((a, b) => a.row - b.row || a.x - b.x);
}

/**
 * The one skill to suggest training next, or null when every skill is done.
 *
 * The start skill comes first. After that, an open skill in the branch with the fewest finished
 * skills, so the player stays all-round (ties go to the branch listed first, then the lowest
 * tier). The final skill is suggested once it's the only one left open.
 */
export function nextUp(tree: Tree, done: Set<string>): Skill | null {
  const open = tree.skills.filter((s) => skillState(s, done) === "available");
  if (open.length === 0) return null;
  const start = open.find((s) => s.requires.length === 0);
  if (start) return start;
  const doneIn = (branch: string) => tree.skills.filter((s) => s.branch === branch && done.has(s.id)).length;
  for (const b of [...tree.branches].sort((a, c) => doneIn(a.id) - doneIn(c.id))) {
    const first = inUnlockOrder(open.filter((s) => s.branch === b.id))[0];
    if (first) return first;
  }
  return inUnlockOrder(open)[0];
}
