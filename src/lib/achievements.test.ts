import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../data/achievements";
import { football } from "../data/football";
import { weights } from "../data/weights";
import { applyAchievements, earnedAchievements, earnedInLedger, ruleMet, type AchievementContext } from "./achievements";
import { isEventKey, achievementKey, totalXp, revoke } from "./xp";
import { reconcile } from "./xpSync";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-25T11:00:00.000Z";

const base = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  tree: football,
  done: new Set(),
  practiceDays: [],
  streakWeeks: 0,
  levelIndex: -1,
  results: 0,
  ...over,
});
const branchIds = (id: string) => football.skills.filter((s) => s.branch === id).map((s) => s.id);
const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`);

describe("the list", () => {
  it("has about twenty achievements with unique ids, titles and valid event keys", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(isEventKey(achievementKey(a.id)), a.id).toBe(true);
      expect(a.title.length, a.id).toBeGreaterThan(2);
      expect(a.text.length, a.id).toBeGreaterThan(8);
    }
  });

  it("can all be earned in both trees' size (no count asks for more than the tree has)", () => {
    for (const tree of [football, weights]) {
      for (const a of ACHIEVEMENTS) {
        if (a.rule.kind === "skills") expect(a.rule.count, `${tree.id} ${a.id}`).toBeLessThanOrEqual(tree.skills.length);
        if (a.rule.kind === "branchesComplete") expect(a.rule.count, `${tree.id} ${a.id}`).toBeLessThanOrEqual(tree.branches.length);
      }
    }
  });
});

describe("the rules", () => {
  it("nothing is earned by a brand new player", () => {
    expect(earnedAchievements(base())).toEqual([]);
  });

  it("counts passed skills", () => {
    expect(earnedAchievements(base({ done: new Set(["root"]) }))).toEqual(["first-skill"]);
    const five = new Set(football.skills.slice(0, 5).map((s) => s.id));
    expect(earnedAchievements(base({ done: five }))).toEqual(["first-skill", "five-skills"]);
    const twenty = new Set(football.skills.slice(0, 20).map((s) => s.id));
    expect(earnedAchievements(base({ done: twenty }))).toEqual(expect.arrayContaining(["ten-skills", "twenty-skills"]));
  });

  it("every-skill needs every skill, including the start and the final one", () => {
    const all = new Set(football.skills.map((s) => s.id));
    expect(earnedAchievements(base({ done: all }))).toContain("every-skill");
    all.delete("final");
    expect(earnedAchievements(base({ done: all }))).not.toContain("every-skill");
  });

  it("finishing branches: one, then three, only when every skill of them is passed", () => {
    const bc = new Set(branchIds("bc"));
    expect(earnedAchievements(base({ done: bc }))).toContain("first-branch");
    const almost = new Set([...branchIds("bc").slice(1)]);
    expect(earnedAchievements(base({ done: almost }))).not.toContain("first-branch");
    const three = new Set([...branchIds("bc"), ...branchIds("ps"), ...branchIds("dr")]);
    expect(earnedAchievements(base({ done: three }))).toContain("three-branches");
  });

  it("well rounded needs one skill in every branch, and no more", () => {
    const one = new Set(football.branches.map((b) => branchIds(b.id)[0]!));
    expect(earnedAchievements(base({ done: one }))).toContain("well-rounded");
    one.delete(branchIds("ft")[0]!);
    expect(earnedAchievements(base({ done: one }))).not.toContain("well-rounded");
  });

  it("training days count different days, not repeats", () => {
    expect(earnedAchievements(base({ practiceDays: ["2026-11-25", "2026-11-25"] }))).toEqual(["first-day"]);
    expect(earnedAchievements(base({ practiceDays: days(10) }))).toEqual(expect.arrayContaining(["first-day", "ten-days"]));
    expect(earnedAchievements(base({ practiceDays: days(50) }))).toContain("fifty-days");
    expect(earnedAchievements(base({ practiceDays: days(9) }))).not.toContain("ten-days");
  });

  it("streaks", () => {
    expect(earnedAchievements(base({ streakWeeks: 3 }))).toEqual([]);
    expect(earnedAchievements(base({ streakWeeks: 4 }))).toEqual(["streak-4"]);
    expect(earnedAchievements(base({ streakWeeks: 8 }))).toEqual(["streak-4", "streak-8"]);
  });

  it("levels, from picking one to Expert", () => {
    expect(earnedAchievements(base({ levelIndex: 0 }))).toEqual(["pick-level"]);
    expect(earnedAchievements(base({ levelIndex: 1 }))).toEqual(["pick-level", "intermediate"]);
    expect(earnedAchievements(base({ levelIndex: 3 }))).toEqual(["pick-level", "intermediate", "advanced", "expert"]);
  });

  it("saved results", () => {
    expect(earnedAchievements(base({ results: 1 }))).toEqual(["first-result"]);
    expect(earnedAchievements(base({ results: 20 }))).toEqual(["first-result", "five-results", "twenty-results"]);
  });

  it("ruleMet agrees with earnedAchievements for every rule", () => {
    const ctx = base({ done: new Set(football.skills.map((s) => s.id)), practiceDays: days(60), streakWeeks: 9, levelIndex: 3, results: 25 });
    expect(earnedAchievements(ctx)).toEqual(ACHIEVEMENTS.map((a) => a.id));
    for (const a of ACHIEVEMENTS) expect(ruleMet(a.rule, ctx), a.id).toBe(true);
  });

  it("works for the weights tree too", () => {
    const done = new Set(weights.skills.map((s) => s.id));
    const earned = earnedAchievements(base({ tree: weights, done }));
    expect(earned).toEqual(expect.arrayContaining(["every-skill", "first-branch", "three-branches", "well-rounded"]));
  });
});

describe("awarding", () => {
  it("adds earned achievements to the ledger once, worth no XP", () => {
    const once = applyAchievements([], ["first-skill"], T1);
    expect(once).toHaveLength(1);
    expect(totalXp(once)).toBe(0);
    expect(applyAchievements(once, ["first-skill"], T2)).toBe(once);
    expect(earnedInLedger(once)).toEqual(["first-skill"]);
  });

  it("keeps a trophy when a skill is un-ticked later: reconcile never switches achievements off", () => {
    let ledger = reconcile(football, [], ["root"], [], T1);
    ledger = applyAchievements(ledger, earnedAchievements(base({ done: new Set(["root"]) })), T1);
    ledger = reconcile(football, ledger, [], [], T2);
    expect(earnedInLedger(ledger)).toEqual(["first-skill"]);
  });

  it("only an explicit revoke removes one", () => {
    const ledger = applyAchievements([], ["first-skill"], T1);
    expect(earnedInLedger(revoke(ledger, achievementKey("first-skill"), T2))).toEqual([]);
  });
});
