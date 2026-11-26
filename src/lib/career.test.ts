import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import type { RatingSnapshot } from "./ratingHistory";
import { branchLines, careerTotals, longestStreak, missionsCompleted, ranksReached, splitMinutes, xpPerWeek } from "./career";
import type { XpEvent } from "./xp";

const ev = (key: string, at: string, xp = 10, active = true): XpEvent => ({ key, xp, active, at });
// Local-time noon, so the local day is the same in every time zone.
const noon = (day: string) => `${day}T12:00:00`;

describe("longestStreak", () => {
  it("counts consecutive weeks with 3 or more days", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-16", "2026-11-17"];
    expect(longestStreak(days)).toBe(2);
  });
  it("a missed week starts the run again", () => {
    const week = (m: string) => [`${m}-02`, `${m}-03`, `${m}-04`];
    expect(longestStreak([...week("2026-11"), ...week("2026-12")])).toBe(1);
  });
  it("is 0 with no training", () => expect(longestStreak([])).toBe(0));
});

describe("careerTotals", () => {
  it("counts distinct training days, estimated minutes and results", () => {
    const skill = football.skills.find((s) => s.routine)!;
    const sessions = [{ date: "2026-11-02", skillId: skill.id }, { date: "2026-11-03", skillId: skill.id }];
    const totals = careerTotals(football, ["2026-11-02", "2026-11-04"], sessions, [], null);
    expect(totals.sessions).toBe(3);
    expect(totals.minutes).toBeGreaterThan(0);
    expect(totals.results).toBe(0);
  });
});

describe("splitMinutes", () => {
  it("splits into hours and minutes", () => expect(splitMinutes(135)).toEqual({ hours: 2, minutes: 15 }));
});

describe("XP", () => {
  const events = [ev("session:a", noon("2026-11-03"), 40), ev("mission:a:b", noon("2026-11-04"), 60), ev("session:b", noon("2026-11-10"), 40), ev("session:c", noon("2026-11-11"), 40, false)];
  it("sums active events per week with empty weeks as 0", () => {
    const weeks = xpPerWeek(events, "2026-11-12", 3);
    expect(weeks.map((w) => w.week)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(weeks.map((w) => w.xp)).toEqual([0, 100, 40]);
  });
  it("counts earned missions only", () => expect(missionsCompleted(events)).toBe(1));
});

describe("ranksReached", () => {
  it("dates each rank by the Nth skill pass in the ledger", () => {
    const second = football.levels[1];
    const events = Array.from({ length: second.at }, (_, i) => ev(`skill:s${i}:pass`, noon(`2026-11-${String(i + 1).padStart(2, "0")}`)));
    const ranks = ranksReached(football, second.at, events);
    expect(ranks.map((r) => r.name)).toEqual([football.levels[0].name, second.name]);
    expect(ranks[1].day).toBe(`2026-11-${String(second.at).padStart(2, "0")}`);
  });
  it("has no date when the ledger holds too few passes", () => {
    expect(ranksReached(football, football.levels[1].at, [])[1].day).toBeNull();
  });
});

describe("branchLines", () => {
  const snap = (week: string, bc: number): RatingSnapshot => ({ week, ratings: { bc }, overall: bc, at: "2026-11-01T00:00:00Z" });
  it("draws a line for a branch with two weeks and keeps a flat line in range", () => {
    const [line] = branchLines(football, [snap("2026-11-02", 10), snap("2026-11-09", 10)]);
    expect(line.branchId).toBe("bc");
    expect(line.points.split(" ")).toHaveLength(2);
    expect(line.high - line.low).toBeGreaterThanOrEqual(10);
  });
  it("gives no points for a single week", () => {
    expect(branchLines(football, [snap("2026-11-02", 10)])[0].points).toBe("");
  });
});
