import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { levelInfo, newlyUnlocked, skillState, targetFor, validateTree } from "./progress";

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

describe("player levels", () => {
  const sprint = football.skills.find((s) => s.id === "ft2")!;

  it("shows only the chosen level's target", () => {
    expect(targetFor(sprint, "intermediate")).toBe("Under 5.3 seconds.");
    expect(targetFor(sprint, "expert")).toBe("Under 4.55 seconds.");
  });

  it("shows no target before a level is picked, or for skills without targets", () => {
    expect(targetFor(sprint, null)).toBeNull();
    expect(targetFor(football.skills[0], "expert")).toBeNull();
  });

  it("catches a skill missing a level's target", () => {
    const broken = {
      ...football,
      skills: football.skills.map((s) => (s.id === "ft2" ? { ...s, targets: { beginner: "Under 6 seconds." } } : s)),
    };
    expect(validateTree(broken).some((e) => e.startsWith("ft2: no target for level"))).toBe(true);
  });
});
