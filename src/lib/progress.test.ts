import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { levelInfo, newlyUnlocked, skillState, validateTree } from "./progress";

describe("progress rules", () => {
  it("starts with only the root skill available", () => {
    const available = football.skills.filter((s) => skillState(s, new Set()) === "available");
    expect(available.map((s) => s.id)).toEqual(["root"]);
  });

  it("unlocks the six branch starters after the root", () => {
    expect(newlyUnlocked(football, new Set(), "root")).toHaveLength(6);
  });

  it("picks the right level", () => {
    expect(levelInfo(football.levels, 0).current.name).toBe("Sunday League");
    expect(levelInfo(football.levels, 32).current.name).toBe("Legend");
  });
});

describe("tree checker", () => {
  it("catches a test with no number in it", () => {
    const broken = {
      ...football,
      skills: football.skills.map((s) => (s.id === "bc1" ? { ...s, test: "Juggle a lot." } : s)),
    };
    expect(validateTree(broken)).toContain("bc1: test has no number in it, so nobody can tell when they've passed");
  });

  it("catches a skill that requires a missing skill", () => {
    const broken = {
      ...football,
      skills: football.skills.map((s) => (s.id === "ps1" ? { ...s, requires: ["nope"] } : s)),
    };
    expect(validateTree(broken)).toContain("ps1: requires unknown skill nope");
  });
});
