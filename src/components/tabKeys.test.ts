import { describe, expect, it } from "vitest";
import { nextTabIndex } from "./tabKeys";

describe("arrow keys in a row of tabs", () => {
  it("moves right and left, and wraps around the ends", () => {
    expect(nextTabIndex("ArrowRight", 0, 4)).toBe(1);
    expect(nextTabIndex("ArrowRight", 3, 4)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 2, 4)).toBe(1);
    expect(nextTabIndex("ArrowLeft", 0, 4)).toBe(3);
  });

  it("jumps to the first and last tab with Home and End", () => {
    expect(nextTabIndex("Home", 2, 5)).toBe(0);
    expect(nextTabIndex("End", 1, 5)).toBe(4);
  });

  it("leaves every other key to the browser", () => {
    expect(nextTabIndex("Tab", 1, 4)).toBeNull();
    expect(nextTabIndex("Enter", 1, 4)).toBeNull();
    expect(nextTabIndex("ArrowDown", 1, 4)).toBeNull();
  });

  it("does nothing with no tabs", () => {
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
