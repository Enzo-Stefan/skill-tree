import type { Skill } from "../types";

// Test gating (#126 item 4, plan/content-audit-126.md). The easier skills teach the basics, so "I passed" stays a
// plain button there. From the fourth tier of a branch on, a skill is only passed by running its test in test
// mode, because those are the skills the leaderboard, XP and mastery lean on, and the easiest to over-claim.
// Skills whose check is "done" ("Run 3 km", "play a full match") have no counter or timer, so they stay exempt.
// Players who already passed a skill keep it: this only decides how a new pass is made.

/** The first tier (row) that needs a test. Rows run from 0 at the top; every branch has rows 1 to 4. */
export const TEST_REQUIRED_FROM_ROW = 3;

/** True when the skill can only be passed by taking its test: a branch skill from the gating tier, with a counter or timer test. */
export function needsTest(skill: Skill): boolean {
  return skill.branch !== null && skill.row >= TEST_REQUIRED_FROM_ROW && skill.check !== undefined && skill.check.kind !== "done";
}
