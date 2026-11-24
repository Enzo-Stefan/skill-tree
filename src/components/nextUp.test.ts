import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { nextSkill } from "../lib/progress";
import { inUnlockOrder, nextUpReason } from "./nextUp";

const ids = (tree: typeof football, branch: string) => inUnlockOrder(tree.skills.filter((s) => s.branch === branch)).map((s) => s.id);
const reasonFor = (done: Set<string>) => nextUpReason(football, nextSkill(football, done)!, done);
const firsts = football.branches.map((b) => football.skills.find((s) => s.branch === b.id && s.requires.includes("root"))!.id);

describe("nextUpReason", () => {
  it("says start for the start skill", () => {
    expect(reasonFor(new Set())).toBe("start");
  });

  it("says even when every branch is level", () => {
    expect(reasonFor(new Set(["root"]))).toBe("even");
  });

  it("says least when one branch is behind the rest", () => {
    const done = new Set(["root", ...firsts.slice(0, -1)]);
    expect(nextSkill(football, done)?.branch).toBe(football.branches[football.branches.length - 1].id);
    expect(reasonFor(done)).toBe("least");
  });

  it("says final for the final skill", () => {
    const all = football.skills.filter((s) => s.id !== "final").map((s) => s.id);
    expect(reasonFor(new Set(all))).toBe("final");
  });

  it("ignores finished branches when deciding least", () => {
    // Every branch done except one skill in the first branch: that branch isn't "level" with done ones.
    const first = football.branches[0].id;
    const last = inUnlockOrder(football.skills.filter((s) => s.branch === first)).slice(-1)[0];
    const done = new Set(football.skills.filter((s) => s.id !== "final" && s.id !== last.id).map((s) => s.id));
    expect(reasonFor(done)).toBe("least");
  });
});

describe("inUnlockOrder", () => {
  it("orders a branch by tier, then left to right", () => {
    expect(ids(football, "ps")).toEqual(["ps1", "ps2", "ps3", "ps4", "ps5"]);
  });
});
