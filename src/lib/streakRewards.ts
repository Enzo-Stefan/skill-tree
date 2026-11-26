import { XP_AMOUNTS } from "../data/xp";
import { amountFor, award, streakKey, type XpEvent } from "./xp";

// Streak rewards (#121 item 6): an XP bonus when the training streak (src/lib/streak.ts) reaches a milestone. The key
// names the run the streak belongs to, so a streak that restarts after a level step can earn the bonuses again, and
// the same run never pays twice.

/** The milestone weeks, smallest first. */
export function milestones(): number[] {
  return Object.keys(XP_AMOUNTS.streak).map(Number).sort((a, b) => a - b);
}

/** Which milestones a streak of this many weeks has reached. */
export function reachedMilestones(streakWeeks: number): number[] {
  return milestones().filter((m) => streakWeeks >= m);
}

/** The ledger with a bonus for every milestone the streak has reached. `since` is the streak's start week (or null for the first run). */
export function applyStreakRewards(events: XpEvent[], streakWeeks: number, since: string | null, now: string): XpEvent[] {
  let next = events;
  for (const weeks of reachedMilestones(streakWeeks)) {
    const key = streakKey(weeks, since);
    next = award(next, key, amountFor(key), now);
  }
  return next;
}
