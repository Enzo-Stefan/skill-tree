import { STEPS_PER_LEVEL } from "./progress";
import { amountFor, award, hasAward, masteryKey, type MasteryTier, type XpEvent } from "./xp";

// Skill mastery (#121 item 5, rule chosen by Stefan: one full level above the previous tier).
//
//   bronze  passing the skill. The player's level step (1 to 16) at that pass is kept. 50 XP for a pass made now.
//   silver  passing its test again at a level step at least one level (4 steps) above the bronze pass.
//   gold    passing its test again at a step at least one level above the silver pass.
//
// The bar is capped at step 16, and a tier earned at step 16 is the last one. So gold needs a silver pass below step 16,
// which needs a bronze pass at step 11 or below: gold is for players who passed the skill early and came back twice,
// spread over three levels (for example bronze at Beginner, silver at Intermediate, gold at Advanced or Expert).
// A skill first passed at Advanced 4 or higher can reach silver at best.
//
// A skill passed before mastery existed counts as a bronze pass at step 1 (Beginner 1) that pays no XP (its XP was paid
// when it was passed), so silver needs Intermediate 1 (step 5) or above. This bronze is worked out from the pass (see
// masteryOf), never written as a ledger row, so it cannot overwrite a real 50-XP bronze when ledgers merge. Everything is kept in the XP ledger, so it syncs like XP:
//   mastery:<skill>:<tier>        the tier, worth its XP (bronze 50, silver 100, gold 150)
//   stepat:<skill>:<tier>:<step>  the step it was earned at, worth nothing

export const TIERS: MasteryTier[] = ["bronze", "silver", "gold"];
/** Steps above the previous tier's pass that the next tier needs: one level. */
export const STEPS_BETWEEN_TIERS = STEPS_PER_LEVEL;
/** The highest level step: four levels of four steps. */
const MAX_STEP = 16;

/** The step a skill passed before mastery existed counts as having been passed at: Beginner 1. */
export const LEGACY_STEP = 1;

export const stepAtKey = (skillId: string, tier: MasteryTier, step: number) => `stepat:${skillId}:${tier}:${step}`;

export interface SkillMastery {
  /** The highest tier reached, or null when the skill is not passed. */
  tier: MasteryTier | null;
  /** The step each reached tier was earned at. */
  steps: Partial<Record<MasteryTier, number>>;
}

/**
 * The mastery of every skill, from the ledger. Only active events count, so an undone pass takes its tiers away. A skill
 * that is passed but has no tier of its own (a pass from before mastery existed) is bronze at LEGACY_STEP, worked out
 * here rather than stored. The result has no prototype, so a key like "mastery:__proto__:bronze" is just another id.
 */
export function masteryOf(events: XpEvent[]): Record<string, SkillMastery> {
  const out: Record<string, SkillMastery> = Object.create(null);
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
  for (const e of events) {
    const m = e.active ? /^skill:(.+):pass$/.exec(e.key) : null;
    if (m && !out[m[1]!]) out[m[1]!] = { tier: "bronze", steps: { bronze: LEGACY_STEP } };
  }
  return out;
}

/** The highest tier per skill, for the rating formula and the badge. */
export function tiersOf(events: XpEvent[]): Record<string, MasteryTier> {
  const out: Record<string, MasteryTier> = Object.create(null);
  for (const [id, m] of Object.entries(masteryOf(events))) if (m.tier) out[id] = m.tier;
  return out;
}

/** The ledger with the bronze tier (and the step it was earned at) awarded. Does nothing when bronze is already held. */
export function recordPass(events: XpEvent[], skillId: string, step: number, now: string): XpEvent[] {
  if (hasAward(events, masteryKey(skillId, "bronze"))) return events;
  // No level picked is step 0; a pass is never recorded below Beginner 1 (LEGACY_STEP), or silver would come a step early.
  const at = Math.min(MAX_STEP, Math.max(LEGACY_STEP, Math.round(step)));
  const withTier = award(events, masteryKey(skillId, "bronze"), amountFor(masteryKey(skillId, "bronze")), now);
  return award(withTier, stepAtKey(skillId, "bronze", at), 0, now);
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
  const heldAt = info.steps[info.tier] ?? LEGACY_STEP;
  const at = Math.min(MAX_STEP, Math.max(0, Math.round(step)));
  // The bar is capped at step 16, so a player who earned a tier at Expert 3 can still reach the next one. A tier earned at
  // step 16 itself has nothing above it, so it cannot be followed by another: three passes at step 16 never make gold.
  if (heldAt >= MAX_STEP || at < Math.min(MAX_STEP, heldAt + STEPS_BETWEEN_TIERS)) return { events, result: "tooSoon" };
  const withTier = award(events, masteryKey(skillId, next), amountFor(masteryKey(skillId, next)), now);
  return { events: award(withTier, stepAtKey(skillId, next, at), 0, now), result: next as "silver" | "gold" };
}

/** The lowest level step at which the next tier can be earned, or null when there is none (not passed, or gold). */
export function stepNeededForNext(events: XpEvent[], skillId: string): number | null {
  const info = masteryOf(events)[skillId];
  if (!info?.tier || info.tier === "gold") return null;
  const heldAt = info.steps[info.tier] ?? LEGACY_STEP;
  return heldAt >= MAX_STEP ? null : Math.min(MAX_STEP, heldAt + STEPS_BETWEEN_TIERS);
}
