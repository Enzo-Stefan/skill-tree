import type { Skill, Tree } from "../types";
import { meetsTarget, type TestResult, resultHistory } from "../lib/results";
import type { MasteryTier } from "../lib/xp";

// The mastery badge on a passed skill. The app does not record a mastery tier yet (src/lib/ratings.ts
// and the XP amounts expect one, but nothing writes it), so it is worked out from what is saved:
//
//   bronze  the skill is passed (the player's own level's target was met)
//   silver  a saved result also meets the target of the second-highest level, step 1
//   gold    a saved result also meets the target of the highest level, step 1
//
// Only skills with number targets and saved results can go past bronze. That is the stopwatch tests for
// now; the others stay bronze until their results are saved too.

/** The tier a passed skill has earned, or null for a skill that is not passed. */
export function masteryTier(tree: Tree, skill: Skill, passed: boolean, results: TestResult[]): MasteryTier | null {
  if (!passed) return null;
  const levels = tree.playerLevels ?? [];
  if (levels.length < 3) return "bronze";
  const mine = resultHistory(results, skill.id);
  const reached = (levelIndex: number) =>
    mine.some((r) => meetsTarget(tree, skill, { levelId: levels[levelIndex].id, step: 1 }, r.value) === true);
  if (reached(levels.length - 1)) return "gold";
  if (reached(levels.length - 2)) return "silver";
  return "bronze";
}

/** Tiers for every passed skill in the tree, by skill id. */
export function masteryTiers(tree: Tree, done: Set<string>, results: TestResult[]): Map<string, MasteryTier> {
  const tiers = new Map<string, MasteryTier>();
  for (const s of tree.skills) {
    const tier = masteryTier(tree, s, done.has(s.id), results);
    if (tier) tiers.set(s.id, tier);
  }
  return tiers;
}

/** How many pips the badge shows, so the tiers differ by more than colour. */
export const TIER_PIPS: Record<MasteryTier, number> = { bronze: 1, silver: 2, gold: 3 };
