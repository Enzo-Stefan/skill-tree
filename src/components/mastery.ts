import type { MasteryTier } from "../lib/xp";

// The mastery badge shows a recorded tier only. Nothing records one yet (#121 item 5 will, using
// MasteryTier and masteryKey from src/lib/xp.ts), so no badge shows and none is read out. When it
// lands, pass its tiers to SkillTree (`tiers`) and SkillPage (`tier`).

/** How many pips the badge shows, so the tiers differ by more than colour. */
export const TIER_PIPS: Record<MasteryTier, number> = { bronze: 1, silver: 2, gold: 3 };
