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
const TODAY = "2026-11-26";
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
  it("counts weeks with 3 training days, including the current one", () => {
    const days = MONDAYS.flatMap((m) => week(m, 3));
    expect(streakWeeks(days, null, TODAY)).toBe(4);
  });

  it("does not count the current week until it has 3 days", () => {
    const days = [...MONDAYS.slice(0, 3).flatMap((m) => week(m, 3)), ...week("2026-11-23", 2)];
    expect(streakWeeks(days, null, TODAY)).toBe(3);
  });

  it("pauses after a missed week and carries on when training resumes", () => {
    const days = [...week(MONDAYS[0], 3), ...week(MONDAYS[1], 2), ...week(MONDAYS[2], 3), ...week(MONDAYS[3], 3)];
    expect(streakWeeks(days, null, TODAY)).toBe(3);
  });

  it("counts only weeks in the last 8, the current one included", () => {
    // Oldest counting week for 2026-11-26 is the one starting 2026-10-05.
    const old = ["2026-08-03", "2026-09-07", "2026-09-28"].flatMap((m) => week(m, 3));
    const recent = ["2026-10-05", "2026-11-23"].flatMap((m) => week(m, 3));
    expect(streakWeeks([...old, ...recent], null, TODAY)).toBe(2);
  });

  it("drops a week once it is more than 8 weeks old", () => {
    const days = MONDAYS.flatMap((m) => week(m, 3));
    expect(streakWeeks(days, null, "2026-12-27")).toBe(4);
    expect(streakWeeks(days, null, "2026-12-28")).toBe(3);
  });

  it("ignores weeks up to the one the player moved level in", () => {
    const days = MONDAYS.flatMap((m) => week(m, 3));
    expect(streakWeeks(days, "2026-11-09", TODAY)).toBe(2);
  });
});

describe("level-up question, old weeks", () => {
  it("doesn't ask when the 4 training weeks are spread across months", () => {
    const days = ["2026-06-01", "2026-08-03", "2026-10-05", "2026-11-23"].flatMap((m) => week(m, 3));
    expect(levelUpDue(football, { levelId: "beginner", step: 1 }, days, "2026-11-25", none)).toBeNull();
  });
});

describe("level-up question", () => {
  const days = MONDAYS.flatMap((m) => week(m, 3));
  const today = "2026-11-25";

  const at = (levelId: string, step: number) => ({ levelId, step });

  it("asks after 4 training weeks, about the next step", () => {
    expect(levelUpDue(football, at("beginner", 1), days, today, none)).toEqual(at("beginner", 2));
  });

  it("after step 4, asks about step 1 of the next level", () => {
    expect(levelUpDue(football, at("beginner", 4), days, today, none)).toEqual(at("intermediate", 1));
  });

  it("does not ask before 4 weeks, past the top step, or without a level", () => {
    expect(levelUpDue(football, at("beginner", 1), days.slice(3), today, none)).toBeNull();
    expect(levelUpDue(football, at("expert", 4), days, today, none)).toBeNull();
    expect(levelUpDue(football, null, days, today, none)).toBeNull();
  });

  it("still asks at Expert 3, about Expert 4", () => {
    expect(levelUpDue(football, at("expert", 3), days, today, none)).toEqual(at("expert", 4));
  });

  it("asks at most once a week, then again the next week", () => {
    const asked = { since: null, askedWeek: "2026-11-23" };
    expect(levelUpDue(football, at("beginner", 1), days, today, asked)).toBeNull();
    const nextWeek = [...days, ...week("2026-11-30", 3)];
    expect(levelUpDue(football, at("beginner", 1), nextWeek, "2026-12-02", asked)).toEqual(at("beginner", 2));
  });

  it("needs a fresh streak after moving up", () => {
    expect(levelUpDue(football, at("beginner", 2), days, today, { since: "2026-11-23", askedWeek: null })).toBeNull();
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
