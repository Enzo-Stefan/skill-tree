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

describe("test targets", () => {
  it("lists each skill with a target at that level and step", async () => {
    const { testTargets } = await import("./progress");
    const items = testTargets(football, { levelId: "intermediate", step: 1 });
    expect(items.length).toBe(football.skills.filter((s) => s.targets).length);
    expect(items.length).toBeGreaterThan(0);
    expect(testTargets(football, null)).toEqual([]);
  });
});

describe("next skill", () => {
  it("starts with the start skill", async () => {
    const { nextSkill } = await import("./progress");
    expect(nextSkill(football, new Set())?.id).toBe("root");
  });

  it("then goes to the branch with the least done, first branch on a tie", async () => {
    const { nextSkill } = await import("./progress");
    const firsts = football.branches.map((b) => football.skills.find((s) => s.branch === b.id && s.requires.includes("root"))!.id);
    expect(nextSkill(football, new Set(["root"]))?.branch).toBe(football.branches[0].id);
    // Finish the first skill of every branch except Fitness: Fitness has the smallest share now.
    const done = new Set(["root", ...firsts.slice(0, -1)]);
    expect(nextSkill(football, done)?.branch).toBe(football.branches[football.branches.length - 1].id);
  });

  it("only suggests unlocked skills that aren't done", async () => {
    const { nextSkill } = await import("./progress");
    let done = new Set<string>();
    // Follow the suggestions all the way: each one must be available, and it ends with everything done.
    for (let i = 0; i < football.skills.length; i++) {
      const next = nextSkill(football, done);
      expect(next).not.toBeNull();
      expect(skillState(next!, done)).toBe("available");
      done = new Set(done).add(next!.id);
    }
    expect(nextSkill(football, done)).toBeNull();
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

describe("test checks (idea 4)", () => {
  const withCheck = (id: string, check: unknown) => ({
    ...football,
    skills: football.skills.map((s) => (s.id === id ? { ...s, check } : s)),
  }) as typeof football;

  it("every skill in every tree has one", async () => {
    const { trees } = await import("../data");
    for (const tree of trees) for (const s of tree.skills) expect(s.check, `${tree.id}/${s.id}`).toBeDefined();
  });

  it("catches a missing check", () => {
    expect(validateTree(withCheck("bc1", undefined))).toContain("bc1: has no check, so test mode can't count or time it");
  });

  it("catches numbers that don't match the test text", () => {
    // ps1 says "8 of 10 passes".
    expect(validateTree(withCheck("ps1", { kind: "hits", needed: 7, attempts: 10 }))).toContain("ps1: check needed 7 isn't in the test text");
  });

  it("catches more hits than attempts", () => {
    expect(validateTree(withCheck("ps1", { kind: "hits", needed: 10, attempts: 8 }))).toContain("ps1: check needs 10 hits from only 8 attempts");
  });

  it("catches a timed check with no limit", () => {
    expect(validateTree(withCheck("dr1", { kind: "time" }))).toContain("dr1: timed check has no limit: give it under, or targets");
  });

  it("gives the stopwatch limit: its own, or the level target", async () => {
    const { timeLimit } = await import("./progress");
    const skill = (id: string) => football.skills.find((s) => s.id === id)!;
    expect(timeLimit(football, skill("dr1"), null)).toBe(15);
    expect(timeLimit(football, skill("ft2"), { levelId: "beginner", step: 1 })).toBe(5.8);
    expect(timeLimit(football, skill("ft2"), null)).toBeNull();
    expect(timeLimit(football, skill("bc1"), null)).toBeNull();
  });
});

describe("test checks: in a row, and time numbers", () => {
  const withCheck = (id: string, check: unknown) =>
    ({ ...football, skills: football.skills.map((s) => (s.id === id ? { ...s, check } : s)) }) as typeof football;

  it("marks the counts where a miss starts again", async () => {
    const { weights } = await import("../data/weights");
    for (const tree of [football, weights]) {
      for (const s of tree.skills) {
        const inARow = s.check?.kind === "count" && s.check.inARow === true;
        // In the English trees the sentence says so; translations are checked by their own tests.
        expect(inARow, `${tree.id}/${s.id}`).toBe(/in a row/i.test(s.test) && s.check?.kind === "count");
      }
    }
  });

  it("catches best-of and repeat counts that don't match the sentence", () => {
    // ft2 says "best of 3 tries", ft4 says "10 sprints".
    expect(validateTree(withCheck("ft2", { kind: "time", tries: 5 }))).toContain("ft2: check tries 5 isn't in the test text");
    expect(validateTree(withCheck("ft4", { kind: "time", reps: 12 }))).toContain("ft4: check reps 12 isn't in the test text");
  });

  it("catches seconds that don't match, and accepts them written as minutes", () => {
    // ps3 says "in 60 seconds"; df5 says "in 2 minutes"; ft5 says "under 25 minutes".
    expect(validateTree(withCheck("ps3", { kind: "count", needed: 40, seconds: 90 }))).toContain("ps3: check seconds 90 isn't in the test text");
    expect(validateTree(football).filter((e) => e.startsWith("df5") || e.startsWith("ft5"))).toEqual([]);
    expect(validateTree(withCheck("dr1", { kind: "time", under: 20 }))).toContain("dr1: check under 20 isn't in the test text");
  });
});

describe("numbers in the reader's language", () => {
  it("writes decimals the way each language does", async () => {
    const { formatNumber, targetFor } = await import("./progress");
    expect(formatNumber(5.8)).toBe("5.8");
    expect(formatNumber(5.8, "es")).toBe("5,8");
    expect(formatNumber(1500, "es")).toBe("1500");
    expect(formatNumber(5.675, "en")).toBe("5.68");
    const ft2 = football.skills.find((s) => s.id === "ft2")!;
    expect(targetFor(football, ft2, { levelId: "beginner", step: 1 })).toBe("Under 5.8 seconds.");
    // Only the number follows the locale here. The sentence comes from the tree's data, which is
    // the English tree in this test; the app passes the Spanish tree from treesIn("es").
    expect(targetFor(football, ft2, { levelId: "beginner", step: 1 }, "es")).toBe("Under 5,8 seconds.");
  });

  it("builds the copy text from the words it's given, English by default", async () => {
    const { progressSummary } = await import("./progress");
    const english = progressSummary(football, new Set(["root"]), { levelId: "beginner", step: 2 });
    expect(english.split("\n")[0]).toBe("My hapi skill: 1/32 skills, rank Sunday League. Training at Beginner 2.");
    const words = { headline: (title: string, d: number, total: number, rank: string) => `Mi ${title}: ${d}/${total}, ${rank}.`, training: (r: string) => ` En ${r}.` };
    expect(progressSummary(football, new Set(["root"]), null, words).split("\n")[0]).toBe("Mi hapi skill: 1/32, Sunday League.");
  });

  it("builds the Spanish copy text from es.summary, with the level line", async () => {
    const { progressSummary } = await import("./progress");
    const { es } = await import("../i18n/es");
    const { treesIn } = await import("../data");
    const footballEs = treesIn("es")[0];
    const text = progressSummary(footballEs, new Set(["root"]), { levelId: "beginner", step: 2 }, es.summary);
    expect(text.split("\n")[0]).toBe("Mi hapi skill: 1/32 habilidades, rango Liga de barrio. Entreno en Principiante 2.");
    expect(text.split("\n")[1]).toBe("Control: 0/5");
  });
});

describe("reserved level id", () => {
  it("rejects a player level called \"all\"", () => {
    const levels = football.playerLevels!.map((l, i) => (i === 0 ? { ...l, id: "all" } : l));
    expect(validateTree({ ...football, playerLevels: levels })).toContain('player level id "all" is reserved for trees without levels; pick another id');
  });
});
