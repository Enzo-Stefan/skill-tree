import type { Skill, Tree } from "../types";

/** Skills in the order they unlock: by tier, then left to right. */
export function inUnlockOrder(skills: Skill[]): Skill[] {
  return [...skills].sort((a, b) => a.row - b.row || a.x - b.x);
}

/** Why the Next up card suggests a skill. */
export type NextUpReason = "start" | "final" | "least" | "even";

/**
 * Why `nextSkill` (src/lib/progress.ts) picked `skill`, worded on the card.
 *
 * nextSkill compares branches by the share of their skills that is finished, so this does too:
 * "least" only when the skill's branch has a strictly smaller share than every other branch that
 * still has something to train, "even" when it ties with another one.
 */
export function nextUpReason(tree: Tree, skill: Skill, done: Set<string>): NextUpReason {
  if (skill.requires.length === 0) return "start";
  if (skill.branch === null) return "final";
  const share = (branchId: string) => {
    const skills = tree.skills.filter((s) => s.branch === branchId);
    return skills.filter((s) => done.has(s.id)).length / skills.length;
  };
  const mine = share(skill.branch);
  const others = tree.branches.filter((b) => b.id !== skill.branch).map((b) => share(b.id)).filter((s) => s < 1);
  return others.every((s) => mine < s) ? "least" : "even";
}
