import { ACHIEVEMENTS, type Achievement, type AchievementRule } from "../data/achievements";
import type { Tree } from "../types";
import { achievementKey, amountFor, award, hasAward, type XpEvent } from "./xp";

// Achievements (#121 item 4). Earned from progress, kept in the XP ledger as `achievement:<id>` events, so they
// sync with the account and merge across devices like XP does. An achievement is a trophy: once earned it stays,
// even if a skill is later un-ticked (reconcile in xpSync.ts never switches these off).

export interface AchievementContext {
  tree: Tree;
  done: Set<string>;
  practiceDays: string[];
  /** The current training streak in weeks. */
  streakWeeks: number;
  /** The player's level: -1 none picked, 0 Beginner, 1 Intermediate, 2 Advanced, 3 Expert. */
  levelIndex: number;
  /** How many test results are saved. */
  results: number;
}

function branchSkills(tree: Tree, branchId: string) {
  return tree.skills.filter((s) => s.branch === branchId);
}

/** Whether one rule is met. */
export function ruleMet(rule: AchievementRule, ctx: AchievementContext): boolean {
  const { tree, done } = ctx;
  switch (rule.kind) {
    case "skills":
      return done.size >= rule.count;
    case "everySkill":
      return tree.skills.length > 0 && tree.skills.every((s) => done.has(s.id));
    case "branchesComplete":
      return tree.branches.filter((b) => branchSkills(tree, b.id).every((s) => done.has(s.id))).length >= rule.count;
    case "everyBranchTouched":
      return tree.branches.length > 0 && tree.branches.every((b) => branchSkills(tree, b.id).some((s) => done.has(s.id)));
    case "trainDays":
      return new Set(ctx.practiceDays).size >= rule.count;
    case "streakWeeks":
      return ctx.streakWeeks >= rule.count;
    case "levelAtLeast":
      return ctx.levelIndex >= rule.index;
    case "results":
      return ctx.results >= rule.count;
  }
}

/** The ids of every achievement the player has earned, in list order. */
export function earnedAchievements(ctx: AchievementContext, list: Achievement[] = ACHIEVEMENTS): string[] {
  return list.filter((a) => ruleMet(a.rule, ctx)).map((a) => a.id);
}

/** The ledger with each earned achievement awarded. Awarding twice does nothing; nothing is ever taken away. */
export function applyAchievements(events: XpEvent[], earned: string[], now: string): XpEvent[] {
  let next = events;
  for (const id of earned) next = award(next, achievementKey(id), amountFor(achievementKey(id)), now);
  return next;
}

/** The earned achievement ids held in the ledger (so trophies from another device show here too). */
export function earnedInLedger(events: XpEvent[], list: Achievement[] = ACHIEVEMENTS): string[] {
  return list.filter((a) => hasAward(events, achievementKey(a.id))).map((a) => a.id);
}
