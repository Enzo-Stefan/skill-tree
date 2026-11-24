import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import {
  cleanStep,
  levelInfo,
  newlyUnlocked,
  nextRung,
  progressSummary,
  rungName,
  skillState,
  targetFor,
  targetValue,
  validateTree,
} from "./progress";

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

  const repeat = football.skills.find((s) => s.id === "ft4")!;
  const at = (levelId: string, step: number) => ({ levelId, step });
  const steps = (skill: typeof sprint, levelId: string) => [1, 2, 3, 4].map((n) => targetValue(football, skill, at(levelId, n)));
  const withTargets = (targets: unknown) => ({
    ...football,
    skills: football.skills.map((s) => (s.id === "ft2" ? { ...s, targets } : s)),
  }) as typeof football;

  it("shows only the chosen step's target", () => {
    expect(targetFor(football, sprint, at("intermediate", 1))).toBe("Under 5.3 seconds.");
    expect(targetFor(football, sprint, at("beginner", 2))).toBe("Under 5.67 seconds.");
    expect(targetFor(football, repeat, at("intermediate", 1))).toBe("Each sprint under 7 seconds.");
  });

  it("puts steps 2 to 4 evenly between one level and the next", () => {
    expect(steps(sprint, "beginner")).toEqual([5.8, 5.67, 5.55, 5.42]);
    expect(steps(sprint, "intermediate")).toEqual([5.3, 5.17, 5.05, 4.92]);
    expect(steps(sprint, "advanced")).toEqual([4.8, 4.74, 4.67, 4.61]);
    expect(steps(repeat, "beginner")).toEqual([7.5, 7.37, 7.25, 7.12]);
  });

  it("keeps the top level going at the same pace as the level below it", () => {
    expect(steps(sprint, "expert")).toEqual([4.55, 4.49, 4.42, 4.36]);
    expect(steps(repeat, "expert")).toEqual([6.25, 6.19, 6.12, 6.06]);
  });

  it("rounds an exact half toward the harder target, whichever way targets go", () => {
    const rising = withTargets({ text: "{n} reps.", values: { beginner: 1, intermediate: 1.02, advanced: 1.04, expert: 1.06 } });
    const falling = withTargets({ text: "Under {n} s.", values: { beginner: 1.06, intermediate: 1.04, advanced: 1.02, expert: 1 } });
    const risingSprint = rising.skills.find((s) => s.id === "ft2")!;
    const fallingSprint = falling.skills.find((s) => s.id === "ft2")!;
    const of = (tree: typeof football, skill: typeof sprint) => [1, 2, 3, 4].map((n) => targetValue(tree, skill, at("beginner", n)));
    expect(of(rising, risingSprint)).toEqual([1, 1.01, 1.01, 1.02]);
    expect(of(falling, fallingSprint)).toEqual([1.06, 1.05, 1.05, 1.04]);
  });

  it("shows no target before a level is picked, or for skills without targets", () => {
    expect(targetFor(football, sprint, null)).toBeNull();
    expect(targetFor(football, football.skills[0], at("expert", 1))).toBeNull();
  });

  it("names steps and moves up one step at a time, then to the next level", () => {
    expect(rungName(football, at("beginner", 2))).toBe("Beginner 2");
    expect(nextRung(football, at("beginner", 2))).toEqual(at("beginner", 3));
    expect(nextRung(football, at("beginner", 4))).toEqual(at("intermediate", 1));
    expect(nextRung(football, at("expert", 4))).toBeNull();
    expect(nextRung(football, null)).toBeNull();
  });

  it("treats a missing or broken step as step 1", () => {
    expect([cleanStep(0), cleanStep(5), cleanStep(2.5), cleanStep("2"), cleanStep(3)]).toEqual([1, 1, 1, 1, 3]);
  });

  it("puts the step in the copied summary", () => {
    expect(progressSummary(football, new Set(), at("advanced", 3))).toContain("Training at Advanced 3.");
  });

  it("catches a skill missing a level's target", () => {
    const broken = withTargets({ text: "Under {n} seconds.", values: { beginner: 6 } });
    expect(validateTree(broken).some((e) => e.startsWith("ft2: no target for level"))).toBe(true);
  });

  it("catches target text with nowhere to put the number", () => {
    const broken = withTargets({ ...sprint.targets!, text: "Run fast." });
    expect(validateTree(broken)).toContain("ft2: target text has no {n} where the number goes");
  });

  it("catches target text with more than one place for the number", () => {
    const broken = withTargets({ ...sprint.targets!, text: "Under {n} seconds, then {n} again." });
    expect(validateTree(broken)).toContain("ft2: target text has more than one {n}, only the first gets the number");
  });

  it("catches targets that don't get harder at every level", () => {
    const broken = withTargets({ ...sprint.targets!, values: { beginner: 5.8, intermediate: 5.9, advanced: 4.8, expert: 4.55 } });
    expect(validateTree(broken)).toContain("ft2: targets must get harder at every level, all in the same direction");
  });

  it("catches a target that isn't a positive number", () => {
    const broken = withTargets({ ...sprint.targets!, values: { ...sprint.targets!.values, beginner: -1 } });
    expect(validateTree(broken)).toContain("ft2: target for level beginner is not a positive number");
  });
});

describe("clearPlayerLevel", () => {
  it("forgets the level and step so the picker asks again", async () => {
    const { clearPlayerLevel, loadPlayerLevel, loadPlayerStep, savePlayerLevel, savePlayerStep } = await import("./progress");
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    try {
      const level = football.playerLevels![1].id;
      savePlayerLevel(football.id, level);
      savePlayerStep(football.id, 3);
      expect(loadPlayerLevel(football)).toBe(level);
      clearPlayerLevel(football.id);
      expect(loadPlayerLevel(football)).toBeNull();
      expect(loadPlayerStep(football.id)).toBe(1);
    } finally {
      globalThis.localStorage = real;
    }
  });
});

describe("loadProgress", () => {
  it("drops skill ids the tree no longer has, so the count can't pass the total", async () => {
    const { loadProgress } = await import("./progress");
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    try {
      store.set(`skill-tree:${football.id}`, JSON.stringify(["root", "renamed-skill", 42, "bc1"]));
      expect([...loadProgress(football)]).toEqual(["root", "bc1"]);
      store.set(`skill-tree:${football.id}`, JSON.stringify({ not: "a list" }));
      expect(loadProgress(football).size).toBe(0);
    } finally {
      globalThis.localStorage = real;
    }
  });
});
