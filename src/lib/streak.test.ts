import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { canPickLevel, daysThisWeek, levelUpDue, streakWeeks, weekOf, type StreakState } from "./streak";

// 2026-11-23 is a Monday.
const week = (monday: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1, Number(monday.slice(8)) + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

const MONDAYS = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];
const none: StreakState = { since: null, askedWeek: null };

describe("weeks", () => {
  it("runs Monday to Sunday and crosses month and year ends", () => {
    expect(weekOf("2026-11-23")).toBe("2026-11-23");
    expect(weekOf("2026-11-29")).toBe("2026-11-23");
    expect(weekOf("2026-12-01")).toBe("2026-11-30");
    expect(weekOf("2027-01-01")).toBe("2026-12-28");
  });

  it("counts different training days this week, once each", () => {
    expect(daysThisWeek(["2026-11-23", "2026-11-23", "2026-11-25", "2026-11-16"], "2026-11-26")).toBe(2);
  });
});

describe("streak", () => {
  it("counts weeks in a row with 3 training days, including the current one", () => {
    const days = MONDAYS.flatMap((m) => week(m, 3));
    expect(streakWeeks(days, "2026-11-25")).toBe(4);
  });

  it("does not break the streak while the current week is still in progress", () => {
    const days = [...MONDAYS.slice(0, 3).flatMap((m) => week(m, 3)), ...week("2026-11-23", 1)];
    expect(streakWeeks(days, "2026-11-23")).toBe(3);
  });

  it("resets after a missed week", () => {
    const days = [...week(MONDAYS[0], 3), ...week(MONDAYS[1], 2), ...week(MONDAYS[2], 3), ...week(MONDAYS[3], 3)];
    expect(streakWeeks(days, "2026-11-25")).toBe(2);
  });

  it("ignores weeks up to the one the player moved up in", () => {
    const days = MONDAYS.flatMap((m) => week(m, 3));
    expect(streakWeeks(days, "2026-11-25", "2026-11-09")).toBe(2);
  });
});

describe("level-up question", () => {
  const days = MONDAYS.flatMap((m) => week(m, 3));
  const today = "2026-11-25";

  it("asks after 4 weeks in a row, about the next level", () => {
    expect(levelUpDue(football, "beginner", days, today, none)?.id).toBe("intermediate");
  });

  it("does not ask before 4 weeks, past the top level, or without a level", () => {
    expect(levelUpDue(football, "beginner", days.slice(3), today, none)).toBeNull();
    expect(levelUpDue(football, "expert", days, today, none)).toBeNull();
    expect(levelUpDue(football, null, days, today, none)).toBeNull();
  });

  it("asks at most once a week, then again the next week", () => {
    const asked = { since: null, askedWeek: "2026-11-23" };
    expect(levelUpDue(football, "beginner", days, today, asked)).toBeNull();
    const nextWeek = [...days, ...week("2026-11-30", 3)];
    expect(levelUpDue(football, "beginner", nextWeek, "2026-12-02", asked)?.id).toBe("intermediate");
  });

  it("needs a fresh streak after moving up", () => {
    expect(levelUpDue(football, "intermediate", days, today, { since: "2026-11-23", askedWeek: null })).toBeNull();
  });
});

describe("level picker", () => {
  it("lets a new player pick any level", () => {
    expect(canPickLevel(football, null, "expert")).toBe(true);
  });

  it("only goes down or stays put after the first pick", () => {
    expect(canPickLevel(football, "intermediate", "beginner")).toBe(true);
    expect(canPickLevel(football, "intermediate", "intermediate")).toBe(true);
    expect(canPickLevel(football, "intermediate", "advanced")).toBe(false);
    expect(canPickLevel(football, "beginner", "expert")).toBe(false);
  });
});
