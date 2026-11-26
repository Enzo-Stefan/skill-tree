// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { football } from "../data/football";
import { isRealDay } from "./cloud";
import { completedDependents, forLevel, levelInfo, levelKeys, loadProgress, newlyUnlocked, saveProgress, skillState } from "./progress";
import { dayKey, loadPracticeDays, loadStreakState, oldestCountingWeek, savePracticeDays, saveStreakState, streakWeeks } from "./streak";

// Rules in src/lib that had no direct test: unlocking, undo order, rank thresholds, per-level values,
// real-date checks, and what is kept in this browser.

beforeEach(() => localStorage.clear());
const skillOf = (id: string) => football.skills.find((s) => s.id === id)!;

describe("unlocking", () => {
  it("a skill is locked until everything it requires is done, then available, then done", () => {
    const target = football.skills.find((s) => s.requires.length > 1) ?? football.skills.find((s) => s.requires.length === 1)!;
    expect(skillState(target, new Set())).toBe("locked");
    if (target.requires.length > 1) expect(skillState(target, new Set(target.requires.slice(1)))).toBe("locked");
    expect(skillState(target, new Set(target.requires))).toBe("available");
    expect(skillState(target, new Set([...target.requires, target.id]))).toBe("done");
  });
  it("done wins even when a requirement isn't done", () => {
    expect(skillState(skillOf("ps1"), new Set(["ps1"]))).toBe("done");
  });
  it("newlyUnlocked lists only skills that this one finishes unlocking", () => {
    expect(newlyUnlocked(football, new Set(), "root").map((s) => s.id)).toContain("bc1");
    expect(newlyUnlocked(football, new Set(["root"]), "root")).toEqual([]);
  });
  it("completedDependents lists done skills that need this one, and no others", () => {
    const child = football.skills.find((s) => s.requires.length > 0)!;
    const parent = child.requires[0];
    expect(completedDependents(football, new Set([parent]), parent)).toEqual([]);
    expect(completedDependents(football, new Set([parent, child.id]), parent).map((s) => s.id)).toContain(child.id);
    expect(completedDependents(football, new Set([parent, child.id]), child.id)).toEqual([]);
  });
});

describe("rank thresholds", () => {
  const levels = [
    { at: 0, name: "A" },
    { at: 5, name: "B" },
    { at: 10, name: "C" },
  ];
  it("moves up exactly at the threshold", () => {
    expect(levelInfo(levels, 4).current.name).toBe("A");
    expect(levelInfo(levels, 5).current.name).toBe("B");
    expect(levelInfo(levels, 5).next?.name).toBe("C");
  });
  it("has no next rank at the top", () => {
    expect(levelInfo(levels, 99)).toEqual({ current: levels[2], next: null });
  });
});

describe("per-level values", () => {
  it("levelKeys are the player level ids, or all for a tree without levels", () => {
    expect(levelKeys(football)).toEqual((football.playerLevels ?? []).map((l) => l.id));
    expect(levelKeys({ ...football, playerLevels: undefined })).toEqual(["all"]);
  });
  it("forLevel falls back to all, then to the first value, then null", () => {
    expect(forLevel({ beginner: 1, expert: 3 }, "expert")).toBe(3);
    expect(forLevel({ all: 7 }, "expert")).toBe(7);
    expect(forLevel({ beginner: 2 }, null)).toBe(2);
    expect(forLevel({}, "expert")).toBeNull();
  });
});

describe("dates", () => {
  it("isRealDay rejects impossible and badly written dates", () => {
    expect(isRealDay("2026-02-28")).toBe(true);
    expect(isRealDay("2028-02-29")).toBe(true);
    expect(isRealDay("2026-02-29")).toBe(false);
    expect(isRealDay("2026-13-01")).toBe(false);
    expect(isRealDay("2026-1-1")).toBe(false);
  });
  it("dayKey writes local dates with leading zeros", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("a week 7 Mondays back still counts toward the streak, one more back doesn't", () => {
    const today = "2026-11-26"; // in the week of Monday 2026-11-23
    expect(oldestCountingWeek(today)).toBe("2026-10-05");
    expect(streakWeeks(["2026-10-05", "2026-10-06", "2026-10-07"], null, today)).toBe(1);
    expect(streakWeeks(["2026-09-28", "2026-09-29", "2026-09-30"], null, today)).toBe(0);
  });
});

describe("what's kept in this browser", () => {
  it("finished skills round-trip, and ids the tree dropped are ignored", () => {
    saveProgress(football.id, new Set(["root", "bc1"]));
    expect([...loadProgress(football)].sort()).toEqual(["bc1", "root"]);
    localStorage.setItem(`skill-tree:${football.id}`, JSON.stringify(["root", "gone", 3]));
    expect([...loadProgress(football)]).toEqual(["root"]);
    localStorage.setItem(`skill-tree:${football.id}`, "not json");
    expect(loadProgress(football).size).toBe(0);
  });
  it("training days round-trip, sorted and without repeats, and bad entries are ignored", () => {
    savePracticeDays("t", ["2026-11-18", "2026-11-16", "2026-11-18"]);
    expect(loadPracticeDays("t")).toEqual(["2026-11-16", "2026-11-18"]);
    localStorage.setItem("skill-tree:t:practice-days", JSON.stringify(["2026-11-16", "x", 4]));
    expect(loadPracticeDays("t")).toEqual(["2026-11-16"]);
    localStorage.setItem("skill-tree:t:practice-days", "{");
    expect(loadPracticeDays("t")).toEqual([]);
  });
  it("streak state round-trips, and a broken value means no streak", () => {
    saveStreakState("t", { since: "2026-11-09", askedWeek: "2026-11-16" });
    expect(loadStreakState("t")).toEqual({ since: "2026-11-09", askedWeek: "2026-11-16" });
    localStorage.setItem("skill-tree:t:streak-state", JSON.stringify({ since: 5 }));
    expect(loadStreakState("t")).toEqual({ since: null, askedWeek: null });
    localStorage.setItem("skill-tree:t:streak-state", "{");
    expect(loadStreakState("t")).toEqual({ since: null, askedWeek: null });
  });
});
