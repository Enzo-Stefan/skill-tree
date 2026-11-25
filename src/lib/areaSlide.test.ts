import { describe, expect, it } from "vitest";
import type { Tree } from "../types";
import { slideDirection } from "./areaSlide";

const tree = { branches: [{ id: "a" }, { id: "b" }, { id: "c" }] } as Tree;

describe("slideDirection", () => {
  it("comes from the right for a later area and from the left for an earlier one", () => {
    expect(slideDirection(tree, "a", "c")).toBe(1);
    expect(slideDirection(tree, "c", "b")).toBe(-1);
  });
  it("does not slide when the area is the same", () => {
    expect(slideDirection(tree, "b", "b")).toBe(0);
    expect(slideDirection(tree, null, null)).toBe(0);
  });
  it("treats All as before the first area", () => {
    expect(slideDirection(tree, null, "a")).toBe(1);
    expect(slideDirection(tree, "a", null)).toBe(-1);
  });
});
