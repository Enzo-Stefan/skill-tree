import { describe, expect, it } from "vitest";
import { trees } from ".";
import { validateTree } from "../lib/progress";

describe.each(trees)("$id tree", (tree) => {
  it("has no broken links or duplicate ids", () => {
    expect(validateTree(tree)).toEqual([]);
  });
});
