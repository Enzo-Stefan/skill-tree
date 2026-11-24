import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { weights } from "../data/weights";
import { inUnlockOrder, nextUp } from "./nextUp";

const ids = (tree: typeof football, branch: string) => inUnlockOrder(tree.skills.filter((s) => s.branch === branch)).map((s) => s.id);

describe("nextUp", () => {
  it("starts with the start skill", () => {
    expect(nextUp(football, new Set())?.id).toBe("root");
  });

  it("then suggests the first branch, in the order the tree lists them", () => {
    expect(nextUp(football, new Set(["root"]))?.id).toBe("bc1");
  });

  it("picks the branch with the fewest finished skills", () => {
    // Ball Control has 2 done, every other branch 1, Defending 0.
    const done = new Set(["root", "bc1", "bc2", "ps1", "dr1", "sh1", "ft1"]);
    expect(nextUp(football, done)?.id).toBe("df1");
  });

  it("skips a branch with nothing open", () => {
    // Defending is finished, so nothing in it is open. Every other branch has 1 done.
    const done = new Set(["root", ...ids(football, "df"), "bc1", "ps1", "dr1", "sh1", "ft1"]);
    expect(nextUp(football, done)?.branch).toBe("bc");
  });

  it("suggests the final skill once everything else is done", () => {
    const all = football.skills.filter((s) => s.id !== "final").map((s) => s.id);
    expect(nextUp(football, new Set(all))?.id).toBe("final");
  });

  it("returns null when every skill is done", () => {
    expect(nextUp(football, new Set(football.skills.map((s) => s.id)))).toBeNull();
  });

  it("works for the strength tree too", () => {
    expect(nextUp(weights, new Set())?.id).toBe("root");
    expect(nextUp(weights, new Set(["root"]))?.branch).toBe(weights.branches[0].id);
  });
});

describe("inUnlockOrder", () => {
  it("orders a branch by tier, then left to right", () => {
    expect(ids(football, "ps")).toEqual(["ps1", "ps2", "ps3", "ps4", "ps5"]);
  });
});
