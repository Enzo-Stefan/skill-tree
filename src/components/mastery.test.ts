import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { masteryTier, masteryTiers } from "./mastery";

// Explosive Starts: "Under {n} seconds", beginner 5.8, advanced 4.8, expert 4.55.
const skill = football.skills.find((s) => s.name === "Explosive Starts")!;
const at = (value: number) => ({ skillId: skill.id, date: "2026-11-01", value });

describe("mastery tier", () => {
  it("is none for a skill that is not passed", () => {
    expect(masteryTier(football, skill, false, [at(4)])).toBeNull();
  });
  it("is bronze when passed with no saved result", () => {
    expect(masteryTier(football, skill, true, [])).toBe("bronze");
  });
  it("is bronze when the results only beat the lower levels", () => {
    expect(masteryTier(football, skill, true, [at(5.2)])).toBe("bronze");
  });
  it("is silver when a result meets the second-highest level's target", () => {
    expect(masteryTier(football, skill, true, [at(5.9), at(4.7)])).toBe("silver");
  });
  it("is gold when a result meets the highest level's target", () => {
    expect(masteryTier(football, skill, true, [at(4.5)])).toBe("gold");
  });
  it("ignores other skills' results", () => {
    expect(masteryTier(football, skill, true, [{ ...at(4.0), skillId: "bc1" }])).toBe("bronze");
  });
  it("lists only passed skills", () => {
    const tiers = masteryTiers(football, new Set([skill.id]), [at(4.5)]);
    expect([...tiers.keys()]).toEqual([skill.id]);
    expect(tiers.get(skill.id)).toBe("gold");
  });
});
