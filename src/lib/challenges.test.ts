import { describe, expect, it } from "vitest";
import { CHALLENGES } from "../data/challenges";
import { XP_AMOUNTS } from "../data/xp";
import { challengeAwardKey, challengeDone, challengeProgress, dailyChallenge, periodOf, weeklyChallenge, type ChallengeContext } from "./challenges";
import { amountFor, isEventKey } from "./xp";

function days(from: string, n: number): string[] {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(y, m - 1, d + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
}

describe("the pool", () => {
  it("has unique ids, valid event keys, and enough of each kind to rotate", () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    expect(CHALLENGES.filter((c) => c.period === "daily").length).toBeGreaterThanOrEqual(3);
    expect(CHALLENGES.filter((c) => c.period === "weekly").length).toBeGreaterThanOrEqual(3);
    for (const c of CHALLENGES) expect(isEventKey(challengeAwardKey(c, "2026-11-25")), c.id).toBe(true);
  });
});

describe("the rotation", () => {
  it("gives the same challenge for the same day, every time", () => {
    for (const day of days("2026-11-01", 60)) expect(dailyChallenge(day)).toBe(dailyChallenge(day));
  });

  it("never gives the same daily challenge two days in a row, over a year", () => {
    const all = days("2026-01-01", 400);
    for (let i = 1; i < all.length; i++) expect(dailyChallenge(all[i]!).id, all[i]).not.toBe(dailyChallenge(all[i - 1]!).id);
  });

  it("uses more than one challenge, so it really rotates", () => {
    const seen = new Set(days("2026-01-01", 60).map((d) => dailyChallenge(d).id));
    expect(seen.size).toBeGreaterThan(2);
  });

  it("gives every day of a week the same weekly challenge, and a different one the next week", () => {
    const week = days("2026-11-23", 7);
    expect(new Set(week.map((d) => weeklyChallenge(d).id)).size).toBe(1);
    const weeks = days("2026-01-05", 52 * 7).filter((_, i) => i % 7 === 0);
    for (let i = 1; i < weeks.length; i++) expect(weeklyChallenge(weeks[i]!).id).not.toBe(weeklyChallenge(weeks[i - 1]!).id);
  });

  it("only gives daily challenges as daily and weekly as weekly", () => {
    for (const d of days("2026-11-01", 30)) {
      expect(dailyChallenge(d).period).toBe("daily");
      expect(weeklyChallenge(d).period).toBe("weekly");
    }
  });

  it("works with a pool of one", () => {
    const only = [CHALLENGES.find((c) => c.period === "daily")!];
    expect(dailyChallenge("2026-11-25", only)).toBe(only[0]);
    expect(dailyChallenge("2026-11-26", only)).toBe(only[0]);
  });
});

describe("award keys", () => {
  const daily = CHALLENGES.find((c) => c.period === "daily")!;
  const weekly = CHALLENGES.find((c) => c.period === "weekly")!;

  it("uses the day for a daily challenge and the week's Monday for a weekly one", () => {
    expect(periodOf(daily, "2026-11-25")).toBe("2026-11-25");
    expect(periodOf(weekly, "2026-11-25")).toBe("2026-11-23");
    expect(periodOf(weekly, "2026-11-29")).toBe("2026-11-23");
    expect(challengeAwardKey(weekly, "2026-11-25")).toBe(challengeAwardKey(weekly, "2026-11-28"));
    expect(challengeAwardKey(weekly, "2026-11-25")).not.toBe(challengeAwardKey(weekly, "2026-12-02"));
  });

  it("is worth the daily or weekly amount", () => {
    expect(amountFor(challengeAwardKey(daily, "2026-11-25"), false)).toBe(XP_AMOUNTS.challengeDaily);
    expect(amountFor(challengeAwardKey(weekly, "2026-11-25"), true)).toBe(XP_AMOUNTS.challengeWeekly);
  });
});

describe("checking a challenge", () => {
  const ctx = (over: Partial<ChallengeContext> = {}): ChallengeContext => ({ practiceDays: [], sessions: [], passDays: [], ...over });
  const c = (id: string) => CHALLENGES.find((x) => x.id === id)!;

  it("trainDay: done only on a day the player trained", () => {
    expect(challengeDone(c("d-train"), "2026-11-25", ctx())).toBe(false);
    expect(challengeDone(c("d-train"), "2026-11-25", ctx({ practiceDays: ["2026-11-24"] }))).toBe(false);
    expect(challengeDone(c("d-train"), "2026-11-25", ctx({ practiceDays: ["2026-11-25"] }))).toBe(true);
  });

  it("passSkills: counts passes inside the period only", () => {
    expect(challengeProgress(c("d-pass1"), "2026-11-25", ctx({ passDays: ["2026-11-24", "2026-11-26"] })).have).toBe(0);
    expect(challengeDone(c("d-pass1"), "2026-11-25", ctx({ passDays: ["2026-11-25"] }))).toBe(true);
    expect(challengeProgress(c("w-pass2"), "2026-11-25", ctx({ passDays: ["2026-11-23", "2026-11-29", "2026-11-30"] }))).toEqual({ have: 2, need: 2 });
  });

  it("trainDays: counts different days of the week, not repeats, and not other weeks", () => {
    const week = ["2026-11-23", "2026-11-23", "2026-11-24", "2026-11-30"];
    expect(challengeProgress(c("w-days3"), "2026-11-25", ctx({ practiceDays: week }))).toEqual({ have: 2, need: 3 });
    expect(challengeDone(c("w-days3"), "2026-11-25", ctx({ practiceDays: ["2026-11-23", "2026-11-25", "2026-11-27"] }))).toBe(true);
  });

  it("differentSkills: counts different skills, not repeats of one", () => {
    const sessions = [
      { date: "2026-11-25", skillId: "bc1" },
      { date: "2026-11-25", skillId: "bc1" },
      { date: "2026-11-25", skillId: "ps1" },
      { date: "2026-11-24", skillId: "dr1" },
    ];
    expect(challengeProgress(c("d-focus"), "2026-11-25", ctx({ sessions }))).toEqual({ have: 2, need: 2 });
    expect(challengeProgress(c("w-skills4"), "2026-11-25", ctx({ sessions }))).toEqual({ have: 3, need: 4 });
  });
});
