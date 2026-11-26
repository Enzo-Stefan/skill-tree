import type { Tree } from "../types";
import { STEPS_PER_LEVEL } from "./progress";

// Player ratings (#123, formula approved by Stefan on the issue). Six branch ratings from 0 to 99 and an overall one.
//
//   branch rating = Skills (up to 60) + Level (up to 25) + Mastery (up to 14), capped at 99
//
//   Skills   60 x the weighted share of the branch's skills passed. A skill weighs more the deeper it is:
//            tier 1 counts 1, tier 2 counts 1.5, tier 3 counts 2, tier 4 counts 2.5.
//   Level    25 x (level step, 1 to 16, divided by 16), scaled by how much of the branch is done: full credit
//            from a third of the branch passed, none for an untouched branch.
//   Mastery  14 x the average over the branch's skills of bronze (1/3), silver (2/3) or gold (1). Zero until
//            mastery exists (#121 item 5).
//   Overall  the average of the six rounded branch ratings, rounded.
//
// Worked from saved progress only, so it is the same on every device.

export const MAX_RATING = 99;
export const SKILLS_POINTS = 60;
export const LEVEL_POINTS = 25;
export const MASTERY_POINTS = 14;
/** What a brand-new player shows. 0 as approved; set it higher to start every branch higher (the rest scales into the gap). */
export const RATING_FLOOR = 0;
/** The branch share at which the level counts in full. */
export const LEVEL_FULL_AT_SHARE = 1 / 3;

export type Mastery = "bronze" | "silver" | "gold";
const MASTERY_VALUE: Record<Mastery, number> = { bronze: 1 / 3, silver: 2 / 3, gold: 1 };

/** Tier 1 to 4 weights. Tier 0 (the start skill) and the final skill belong to no branch and are not counted. */
function tierWeight(row: number): number {
  if (row <= 1) return 1;
  if (row === 2) return 1.5;
  if (row === 3) return 2;
  return 2.5;
}

export interface RatingInput {
  tree: Tree;
  /** Ids of the skills passed. */
  done: Set<string>;
  /** The player's level step from 1 to 16 (level index x 4 + step), or 0 when no level is picked. */
  levelStep: number;
  /** The mastery reached per skill id. Missing means none. */
  mastery?: Record<string, Mastery>;
}

export interface Ratings {
  /** Branch id to rating, 0 to 99, in the tree's branch order. */
  branches: Record<string, number>;
  overall: number;
}

/** The level step (1 to 16) from a level id and a step, or 0 when no level is picked. */
export function levelStepOf(tree: Tree, levelId: string | null, step: number): number {
  const index = (tree.playerLevels ?? []).findIndex((l) => l.id === levelId);
  if (index < 0) return 0;
  return Math.min(index * STEPS_PER_LEVEL + Math.min(STEPS_PER_LEVEL, Math.max(1, Math.round(step))), (tree.playerLevels ?? []).length * STEPS_PER_LEVEL);
}

/** One branch's rating before rounding, from 0 to 99. */
function branchScore(input: RatingInput, branchId: string): number {
  const skills = input.tree.skills.filter((s) => s.branch === branchId);
  if (skills.length === 0) return 0;
  const total = skills.reduce((sum, s) => sum + tierWeight(s.row), 0);
  const got = skills.filter((s) => input.done.has(s.id)).reduce((sum, s) => sum + tierWeight(s.row), 0);
  const share = got / total;
  const steps = Math.max(1, (input.tree.playerLevels ?? []).length) * STEPS_PER_LEVEL;
  const levelPart = LEVEL_POINTS * (Math.min(steps, Math.max(0, input.levelStep)) / steps) * Math.min(1, share / LEVEL_FULL_AT_SHARE);
  const masteryAverage = skills.reduce((sum, s) => sum + (input.done.has(s.id) && input.mastery?.[s.id] ? MASTERY_VALUE[input.mastery[s.id]!] : 0), 0) / skills.length;
  const raw = SKILLS_POINTS * share + levelPart + MASTERY_POINTS * masteryAverage;
  return Math.min(MAX_RATING, raw);
}

/** The six branch ratings and the overall rating. */
export function computeRatings(input: RatingInput): Ratings {
  const branches: Record<string, number> = {};
  for (const b of input.tree.branches) {
    const raw = branchScore(input, b.id);
    branches[b.id] = Math.min(MAX_RATING, Math.round(RATING_FLOOR + ((MAX_RATING - RATING_FLOOR) * raw) / MAX_RATING));
  }
  const values = Object.values(branches);
  const overall = values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
  return { branches, overall };
}
