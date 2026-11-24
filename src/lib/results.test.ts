import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { weights } from "../data/weights";
import type { Tree } from "../types";
import {
  addResult,
  bestProgression,
  bestResult,
  cleanResults,
  isNewBestResult,
  loadResults,
  meetsTarget,
  mergeResults,
  replayResults,
  parseResult,
  removeResult,
  resultDirection,
  saveResults,
  type TestResult,
} from "./results";

const skill = (id: string) => football.skills.find((s) => s.id === id)!;
const sprint = (date: string, value: number): TestResult => ({ skillId: "ft2", date, value });

/** Football with one extra skill whose targets go up (reps), to test "higher is better". */
const withReps: Tree = {
  ...football,
  skills: football.skills.map((s) =>
    s.id === "bc1" ? { ...s, targets: { text: "{n} juggles.", values: { beginner: 20, intermediate: 40, advanced: 60, expert: 100 } } } : s,
  ),
};

describe("which way is better", () => {
  it("is lower for timed targets that drop each level", () => {
    expect(resultDirection(football, skill("ft2"))).toBe("lower");
    expect(resultDirection(football, skill("ft4"))).toBe("lower");
  });

  it("is higher for targets that rise each level", () => {
    expect(resultDirection(withReps, withReps.skills.find((s) => s.id === "bc1")!)).toBe("higher");
  });

  it("is unknown for skills without number targets, or trees without levels", () => {
    expect(resultDirection(football, skill("bc1"))).toBeNull();
    expect(resultDirection(weights, weights.skills[1])).toBeNull();
  });
});

describe("typing a result", () => {
  it("accepts dots, commas and spaces, rounded to hundredths", () => {
    expect(parseResult("5.61")).toBe(5.61);
    expect(parseResult(" 5,617 ")).toBe(5.62);
    expect(parseResult("12")).toBe(12);
  });

  it("refuses anything that isn't a positive number", () => {
    for (const bad of ["", "0", "-3", "abc", "5.6s", "1e3", "100001"]) expect(parseResult(bad)).toBeNull();
  });
});

describe("keeping results", () => {
  it("drops broken entries and skills that can't store results, keeping date order", () => {
    const raw = [
      sprint("2026-11-20", 5.7),
      { skillId: "bc1", date: "2026-11-19", value: 20 },
      { skillId: "gone", date: "2026-11-19", value: 5 },
      sprint("2026-02-31", 5.5),
      { skillId: "ft2", date: "2026-11-18", value: "fast" },
      sprint("2026-11-18", 5.9),
      null,
    ];
    expect(cleanResults(football, raw)).toEqual([sprint("2026-11-18", 5.9), sprint("2026-11-20", 5.7)]);
    expect(cleanResults(football, { not: "a list" })).toEqual([]);
  });

  it("adds in date order and removes only the last matching entry", () => {
    let log = addResult(football, [], sprint("2026-11-20", 5.7));
    log = addResult(football, log, sprint("2026-11-18", 5.9));
    log = addResult(football, log, sprint("2026-11-20", 5.7));
    expect(log).toEqual([sprint("2026-11-18", 5.9), sprint("2026-11-20", 5.7), sprint("2026-11-20", 5.7)]);
    expect(removeResult(log, sprint("2026-11-20", 5.7))).toEqual([sprint("2026-11-18", 5.9), sprint("2026-11-20", 5.7)]);
    expect(removeResult(log, sprint("2026-11-21", 5.7))).toBe(log);
  });

  it("saves and loads per tree, cleaning on the way in", () => {
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    try {
      saveResults(football.id, [sprint("2026-11-20", 5.7), { skillId: "gone", date: "2026-11-20", value: 1 }]);
      expect(loadResults(football)).toEqual([sprint("2026-11-20", 5.7)]);
      store.set("skill-tree:football:results", "not json");
      expect(loadResults(football)).toEqual([]);
    } finally {
      globalThis.localStorage = real;
    }
  });
});

describe("bests", () => {
  const log = [sprint("2026-11-01", 6.1), sprint("2026-11-08", 5.9), sprint("2026-11-15", 6.0), sprint("2026-11-22", 5.9)];

  it("picks the fastest time, the earliest when matched later", () => {
    expect(bestResult(football, log, "ft2")).toEqual(sprint("2026-11-08", 5.9));
    expect(bestResult(football, log, "ft4")).toBeNull();
  });

  it("picks the highest count when higher is better", () => {
    const reps = [
      { skillId: "bc1", date: "2026-11-01", value: 18 },
      { skillId: "bc1", date: "2026-11-02", value: 25 },
    ];
    expect(bestResult(withReps, reps, "bc1")?.value).toBe(25);
  });

  it("lists each time the best got better", () => {
    expect(bestProgression(football, log, "ft2")).toEqual([sprint("2026-11-01", 6.1), sprint("2026-11-08", 5.9)]);
  });

  it("knows a new best", () => {
    expect(isNewBestResult(football, [], sprint("2026-11-29", 7))).toBe(true);
    expect(isNewBestResult(football, log, sprint("2026-11-29", 5.8))).toBe(true);
    expect(isNewBestResult(football, log, sprint("2026-11-29", 5.9))).toBe(false);
  });
});

describe("reaching the target", () => {
  const beginner1 = { levelId: "beginner", step: 1 };

  it("needs a time under the target", () => {
    // Beginner 1 on Explosive Starts is under 5.8 seconds.
    expect(meetsTarget(football, skill("ft2"), beginner1, 5.79)).toBe(true);
    expect(meetsTarget(football, skill("ft2"), beginner1, 5.8)).toBe(false);
  });

  it("needs a count of at least the target", () => {
    const juggle = withReps.skills.find((s) => s.id === "bc1")!;
    expect(meetsTarget(withReps, juggle, beginner1, 20)).toBe(true);
    expect(meetsTarget(withReps, juggle, beginner1, 19)).toBe(false);
  });

  it("can't tell without a level or a number target", () => {
    expect(meetsTarget(football, skill("ft2"), null, 5)).toBeNull();
    expect(meetsTarget(football, skill("bc1"), beginner1, 5)).toBeNull();
  });
});

describe("merging results (account sync)", () => {
  it("keeps results from both, and one copy of a result both already have", () => {
    const here = [sprint("2026-11-18", 6.0), sprint("2026-11-20", 5.7)];
    const account = [sprint("2026-11-18", 6.0), sprint("2026-11-19", 5.9)];
    expect(mergeResults(football, here, account)).toEqual([sprint("2026-11-18", 6.0), sprint("2026-11-19", 5.9), sprint("2026-11-20", 5.7)]);
  });

  it("replays a result undone here, and keeps one saved on another device", () => {
    const base = [sprint("2026-11-18", 6.0), sprint("2026-11-19", 9.9)];
    const account = [...base, sprint("2026-11-21", 5.8)];
    expect(replayResults(football, account, base, [sprint("2026-11-18", 6.0)])).toEqual([sprint("2026-11-18", 6.0), sprint("2026-11-21", 5.8)]);
  });

  it("doesn't remove the other copy of a result when an undo is replayed twice", () => {
    const base = [sprint("2026-11-18", 6.0), sprint("2026-11-18", 6.0)];
    const here = [sprint("2026-11-18", 6.0)];
    const account = replayResults(football, base, base, here);
    expect(account).toEqual(here);
    expect(replayResults(football, account, base, here)).toEqual(here);
  });
});
