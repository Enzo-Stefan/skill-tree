import { STEPS_PER_LEVEL } from "./progress";
import { amountFor, award, hasAward, masteryKey, type MasteryTier, type XpEvent } from "./xp";

// Skill mastery (#121 item 5, rule chosen by Stefan: one full level above the previous tier).
//
//   bronze  passing the skill. The player's level step (1 to 16) at that pass is kept.
//   silver  passing its test again at a level step at least one level (4 steps) above the bronze pass.
//   gold    passing its test again at a step at least one level above the silver pass.
//
// A skill passed before mastery existed counts as a bronze pass at step 0 ("before mastery"), so a player at
// Intermediate or above can earn silver straight away. Everything is kept in the XP ledger, so it syncs like XP:
//   mastery:<skill>:<tier>        the tier, worth its XP (bronze 50, silver 100, gold 150)
//   stepat:<skill>:<tier>:<step>  the step it was earned at, worth nothing

export const TIERS: MasteryTier[] = ["bronze", "silver", "gold"];
/** Steps above the previous tier's pass that the next tier needs: one level. */
export const STEPS_BETWEEN_TIERS = STEPS_PER_LEVEL;
/** The highest level step: four levels of four steps. */
const MAX_STEP = 16;

export const stepAtKey = (skillId: string, tier: MasteryTier, step: number) => `stepat:${skillId}:${tier}:${step}`;

export interface SkillMastery {
  /** The highest tier reached, or null when the skill is not passed. */
  tier: MasteryTier | null;
  /** The step each reached tier was earned at. */
  steps: Partial<Record<MasteryTier, number>>;
}

/** The mastery of every skill, from the ledger. Only active events count, so an undone pass takes its tiers away. */
export function masteryOf(events: XpEvent[]): Record<string, SkillMastery> {
  const out: Record<string, SkillMastery> = {};
  for (const e of events) {
    if (!e.active) continue;
    const m = /^mastery:(.+):(bronze|silver|gold)$/.exec(e.key);
    if (!m) continue;
    const skillId = m[1]!;
    const tier = m[2] as MasteryTier;
    const entry = (out[skillId] ??= { tier: null, steps: {} });
    if (!entry.tier || TIERS.indexOf(tier) > TIERS.indexOf(entry.tier)) entry.tier = tier;
  }
  for (const e of events) {
    if (!e.active) continue;
    const m = /^stepat:(.+):(bronze|silver|gold):(\d{1,2})$/.exec(e.key);
    if (!m || !out[m[1]!]) continue;
    const tier = m[2] as MasteryTier;
    // If a tier somehow has two step markers, the highest step counts, so nothing is easier than it should be.
    out[m[1]!]!.steps[tier] = Math.max(out[m[1]!]!.steps[tier] ?? 0, Number(m[3]));
  }
  return out;
}

/** The highest tier per skill, for the rating formula and the badge. */
export function tiersOf(events: XpEvent[]): Record<string, MasteryTier> {
  const out: Record<string, MasteryTier> = {};
  for (const [id, m] of Object.entries(masteryOf(events))) if (m.tier) out[id] = m.tier;
  return out;
}

/** The ledger with the bronze tier (and the step it was earned at) awarded. Does nothing when bronze is already held. */
export function recordPass(events: XpEvent[], skillId: string, step: number, now: string): XpEvent[] {
  if (hasAward(events, masteryKey(skillId, "bronze"))) return events;
  const at = Math.min(MAX_STEP, Math.max(0, Math.round(step)));
  const withTier = award(events, masteryKey(skillId, "bronze"), amountFor(masteryKey(skillId, "bronze")), now);
  return award(withTier, stepAtKey(skillId, "bronze", at), 0, now);
}

/** Bronze for a skill passed before mastery existed: step 0. Does nothing when the skill already has a tier. */
export function backfillBronze(events: XpEvent[], doneSkillIds: Iterable<string>, now: string): XpEvent[] {
  let next = events;
  for (const id of doneSkillIds) next = recordPass(next, id, 0, now);
  return next;
}

export type RetestResult = "silver" | "gold" | "tooSoon" | "maxed" | "notPassed";

/**
 * A test passed again at `step`. The next tier is earned when the step is at least one level above the step of the
 * tier held now. Otherwise nothing changes ("tooSoon": come back at a higher level), or the skill is already gold.
 */
export function recordRetest(events: XpEvent[], skillId: string, step: number, now: string): { events: XpEvent[]; result: RetestResult } {
  const info = masteryOf(events)[skillId];
  if (!info?.tier) return { events, result: "notPassed" };
  if (info.tier === "gold") return { events, result: "maxed" };
  const next = TIERS[TIERS.indexOf(info.tier) + 1]!;
  const heldAt = info.steps[info.tier] ?? 0;
  const at = Math.min(MAX_STEP, Math.max(0, Math.round(step)));
  // At the very top (step 16) the bar is capped there, so a player who earned a tier at Expert 3 can still reach the next.
  if (at < Math.min(MAX_STEP, heldAt + STEPS_BETWEEN_TIERS)) return { events, result: "tooSoon" };
  const withTier = award(events, masteryKey(skillId, next), amountFor(masteryKey(skillId, next)), now);
  return { events: award(withTier, stepAtKey(skillId, next, at), 0, now), result: next as "silver" | "gold" };
}

/** The lowest level step at which the next tier can be earned, or null when there is none (not passed, or gold). */
export function stepNeededForNext(events: XpEvent[], skillId: string): number | null {
  const info = masteryOf(events)[skillId];
  if (!info?.tier || info.tier === "gold") return null;
  return Math.min(MAX_STEP, (info.steps[info.tier] ?? 0) + STEPS_BETWEEN_TIERS);
}
