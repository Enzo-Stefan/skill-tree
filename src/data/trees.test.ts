import { describe, expect, it } from "vitest";
import { trees } from ".";
import { validateTree } from "../lib/progress";

describe.each(trees)("$id tree", (tree) => {
  it("has no broken links or duplicate ids", () => {
    expect(validateTree(tree)).toEqual([]);
  });
});

describe("strength tree routines", () => {
  const weights = trees.find((t) => t.id === "weights")!;

  it("gives every skill a routine, so the Training tab has something for each", () => {
    expect(weights.skills.filter((s) => !s.routine).map((s) => s.id)).toEqual([]);
  });

  it("keeps each routine under the plan's default day limit of 60 minutes", () => {
    for (const s of weights.skills) expect(s.routine!.minutes.all, s.id).toBeLessThanOrEqual(60);
  });
});
