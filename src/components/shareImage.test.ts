import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { mutedBranchColor, shareStats } from "./shareImage";

describe("share image stats", () => {
  it("counts skills per branch and overall, with the current rank", () => {
    const done = new Set(["root", ...football.skills.filter((s) => s.branch === "bc").map((s) => s.id)]);
    const stats = shareStats(football, done, "Beginner", 2, "example.app");
    expect(stats.done).toBe(done.size);
    expect(stats.total).toBe(football.skills.length);
    expect(stats.rank).toBe("Academy");
    const bc = stats.branches.find((b) => b.name === "Ball Control")!;
    expect(bc.done).toBe(bc.total);
    expect(stats.branches.find((b) => b.name === "Passing")!.done).toBe(0);
    expect(stats.nodes.filter((n) => n.done)).toHaveLength(done.size);
  });

  it("ignores ids the tree doesn't have and shows no streak without a level", () => {
    const stats = shareStats(football, new Set(["root", "gone"]), null, 3, "example.app");
    expect(stats.done).toBe(1);
    expect(stats.streak).toBeNull();
    expect(stats.levelName).toBeNull();
  });
});

describe("mutedBranchColor", () => {
  it("mixes 55% of the colour with grey and falls back to grey for non-hex input", () => {
    expect(mutedBranchColor("#ffffff")).toBe("rgb(203, 203, 203)");
    expect(mutedBranchColor("#8c8c8c")).toBe("rgb(140, 140, 140)");
    expect(mutedBranchColor("red")).toBe("rgb(140, 140, 140)");
  });
});
