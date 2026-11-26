// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadStreakState, saveStreakState } from "./streak";

beforeEach(() => localStorage.clear());

describe("loadStreakState", () => {
  it("ignores a saved start or asked week that is not a real day, so no streak key is made from it", () => {
    for (const bad of ["abc", "2026-11-02:x", "2026-02-30", "", 42, null]) {
      localStorage.setItem("skill-tree:football:streak-state", JSON.stringify({ since: bad, askedWeek: bad }));
      expect(loadStreakState("football"), String(bad)).toEqual({ since: null, askedWeek: null });
    }
  });

  it("keeps real days, and survives broken storage", () => {
    saveStreakState("football", { since: "2026-11-02", askedWeek: "2026-11-09" });
    expect(loadStreakState("football")).toEqual({ since: "2026-11-02", askedWeek: "2026-11-09" });
    localStorage.setItem("skill-tree:football:streak-state", "not json");
    expect(loadStreakState("football")).toEqual({ since: null, askedWeek: null });
  });
});
