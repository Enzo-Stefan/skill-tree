import { describe, expect, it } from "vitest";
import { ringFraction } from "./progressRing";

describe("ringFraction", () => {
  it("is the share done", () => {
    expect(ringFraction(3, 5)).toBeCloseTo(0.6);
    expect(ringFraction(0, 5)).toBe(0);
    expect(ringFraction(5, 5)).toBe(1);
  });
  it("copes with an empty branch and out-of-range counts", () => {
    expect(ringFraction(0, 0)).toBe(0);
    expect(ringFraction(9, 5)).toBe(1);
    expect(ringFraction(-1, 5)).toBe(0);
  });
});
