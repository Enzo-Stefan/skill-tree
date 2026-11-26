import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { weights } from "../data/weights";
import type { Tree } from "../types";
import { computeRatings, levelStepOf, MAX_RATING, type Mastery } from "./ratings";

const branch = (tree: Tree, id: string) => tree.skills.filter((s) => s.branch === id).map((s) => s.id);
const first = (n: number, tree: Tree, id: string) => branch(tree, id).slice(0, n);
const values = (r: ReturnType<typeof computeRatings>) => Object.values(r.branches);

describe("the approved examples (#123)", () => {
  it("a new player shows zero everywhere", () => {
    const r = computeRatings({ tree: football, done: new Set(), levelStep: 1 });
    expect(values(r)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(r.overall).toBe(0);
  });

  it("3 Ball Control skills at Beginner 1: 30 in Ball Control, overall 5", () => {
    const r = computeRatings({ tree: football, done: new Set(first(3, football, "bc")), levelStep: 1 });
    expect(r.branches.bc).toBe(30);
    expect(values(r).filter((v) => v === 0)).toHaveLength(5);
    expect(r.overall).toBe(5);
  });

  it("one full branch at Beginner 3: 65, overall 11", () => {
    const r = computeRatings({ tree: football, done: new Set(branch(football, "bc")), levelStep: 3 });
    expect(r.branches.bc).toBe(65);
    expect(r.overall).toBe(11);
  });

  it("3 skills in every branch at Intermediate 2: 38 everywhere", () => {
    const done = new Set(football.branches.flatMap((b) => first(3, football, b.id)));
    const r = computeRatings({ tree: football, done, levelStep: 6 });
    expect(values(r)).toEqual([38, 38, 38, 38, 38, 38]);
    expect(r.overall).toBe(38);
  });

  it("everything passed at Beginner 1 is 62, and at Expert 4 is 85", () => {
    const all = new Set(football.skills.map((s) => s.id));
    expect(computeRatings({ tree: football, done: all, levelStep: 1 }).overall).toBe(62);
    const top = computeRatings({ tree: football, done: all, levelStep: 16 });
    expect(values(top)).toEqual([85, 85, 85, 85, 85, 85]);
    expect(top.overall).toBe(85);
  });
});

describe("mastery", () => {
  const all = new Set(football.skills.map((s) => s.id));
  const withTier = (tier: Mastery) => Object.fromEntries(football.skills.filter((s) => s.branch).map((s) => [s.id, tier]));

  it("adds up to 14: gold on every skill takes the top from 85 to 99", () => {
    expect(computeRatings({ tree: football, done: all, levelStep: 16, mastery: withTier("gold") }).overall).toBe(MAX_RATING);
  });

  it("bronze and silver add a third and two thirds of it", () => {
    const base = computeRatings({ tree: football, done: all, levelStep: 16 }).overall;
    expect(computeRatings({ tree: football, done: all, levelStep: 16, mastery: withTier("bronze") }).overall).toBe(base + 5);
    expect(computeRatings({ tree: football, done: all, levelStep: 16, mastery: withTier("silver") }).overall).toBe(base + 9);
  });

  it("only counts mastery on skills that are still passed", () => {
    const r = computeRatings({ tree: football, done: new Set(), levelStep: 0, mastery: withTier("gold") });
    expect(r.overall).toBe(0);
  });
});

describe("how the number moves", () => {
  it("never goes down when a skill is added, and never up when one is removed", () => {
    const ids = branch(football, "sh");
    let last = -1;
    for (let n = 0; n <= ids.length; n++) {
      const r = computeRatings({ tree: football, done: new Set(ids.slice(0, n)), levelStep: 4 }).branches.sh!;
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it("rises with the level step for the same skills, and a level alone does nothing", () => {
    const done = new Set(first(3, football, "ps"));
    const low = computeRatings({ tree: football, done, levelStep: 1 }).branches.ps!;
    const high = computeRatings({ tree: football, done, levelStep: 16 }).branches.ps!;
    expect(high).toBeGreaterThan(low);
    expect(computeRatings({ tree: football, done: new Set(), levelStep: 16 }).overall).toBe(0);
  });

  it("is 0 to 99 for every combination of one branch, and the overall never exceeds the best branch", () => {
    for (let n = 0; n <= 5; n++) {
      for (const step of [0, 1, 8, 16]) {
        const r = computeRatings({ tree: football, done: new Set(first(n, football, "dr")), levelStep: step });
        for (const v of values(r)) expect(v >= 0 && v <= 99).toBe(true);
        expect(r.overall).toBeLessThanOrEqual(Math.max(...values(r)));
      }
    }
  });

  it("deeper skills count more: the last skill is worth more than the first", () => {
    const ids = branch(football, "bc");
    const firstOnly = computeRatings({ tree: football, done: new Set([ids[0]!]), levelStep: 0 }).branches.bc!;
    const lastOnly = computeRatings({ tree: football, done: new Set([ids[ids.length - 1]!]), levelStep: 0 }).branches.bc!;
    expect(lastOnly).toBeGreaterThan(firstOnly);
  });

  it("ignores the start and final skills, which belong to no branch", () => {
    const r = computeRatings({ tree: football, done: new Set(["root", "final"]), levelStep: 1 });
    expect(r.overall).toBe(0);
  });

  it("works for the weights tree, with its own four branches", () => {
    const r = computeRatings({ tree: weights, done: new Set(weights.skills.map((s) => s.id)), levelStep: 16 });
    expect(Object.keys(r.branches)).toEqual(weights.branches.map((b) => b.id));
    expect(r.overall).toBe(85);
  });
});

describe("levelStepOf", () => {
  it("is 0 with no level, and level index x 4 + step otherwise", () => {
    const [beginner, , advanced] = football.playerLevels!.map((l) => l.id);
    expect(levelStepOf(football, null, 1)).toBe(0);
    expect(levelStepOf(football, "nonsense", 2)).toBe(0);
    expect(levelStepOf(football, beginner!, 1)).toBe(1);
    expect(levelStepOf(football, advanced!, 3)).toBe(11);
  });

  it("keeps a bad step inside 1 to 4", () => {
    const expert = football.playerLevels!.at(-1)!.id;
    expect(levelStepOf(football, expert, 9)).toBe(16);
    expect(levelStepOf(football, expert, -3)).toBe(13);
  });
});
