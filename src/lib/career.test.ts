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
  it("puts XP from before tracking in the week the ledger last changed", () => {
    const backfill = [ev("skill:a:pass", noon("2026-11-12")), ev("skill:b:pass", noon("2026-11-12")), ev("skill:c:pass", noon("2026-11-12"), 20)];
    const weeks = xpPerWeek(backfill, "2026-11-12", 3);
    expect(weeks.map((w) => w.xp)).toEqual([0, 0, 40]);
  });
  it("counts a pass redone after an undo in the week of the redo", () => {
    const redone = [ev("skill:a:pass", "2026-11-16T12:00:00", 10)];
    expect(xpPerWeek(redone, "2026-11-18", 2).map((w) => w.xp)).toEqual([0, 10]);
  });
  it("uses local days at the week boundary", () => {
    const edge = [ev("session:a", "2026-11-08T23:30:00", 10), ev("session:b", "2026-11-09T00:30:00", 10)];
    expect(xpPerWeek(edge, "2026-11-12", 2).map((w) => w.xp)).toEqual([10, 10]);
  });
});

describe("ranksReached", () => {
  const skillIds = (n: number) => football.skills.slice(0, n).map((s) => s.id);
  const dayFor = (i: number) => `2026-11-${String(i + 1).padStart(2, "0")}`;
  it("dates each rank by the day of its Nth marked first pass", () => {
    const second = football.levels[1];
    const done = new Set(skillIds(second.at));
    const events = skillIds(second.at).map((id, i) => ev(`passday:${id}:${dayFor(i)}`, noon(dayFor(i)), 0));
    const ranks = ranksReached(football, done, events);
    expect(ranks.map((r) => r.name)).toEqual([football.levels[0].name, second.name]);
    expect(ranks[1].day).toBe(dayFor(second.at - 1));
  });
  it("gives no date to a rank reached by passes from before tracking", () => {
    const second = football.levels[1];
    const ids = skillIds(second.at);
    // The first two passes have no markers, so they happened before tracking: the first rank has no date.
    const events = ids.slice(2).map((id, i) => ev(`passday:${id}:${dayFor(i + 2)}`, noon(dayFor(i + 2)), 0));
    const ranks = ranksReached(football, new Set(ids), events);
    expect(ranks[0].day).toBeNull();
    expect(ranks[1].day).toBe(dayFor(second.at - 1));
  });
  it("ignores markers for skills not done and inactive markers", () => {
    const [first, second] = football.skills;
    const done = new Set([first.id]);
    const events = [ev(`passday:${first.id}:${dayFor(0)}`, noon(dayFor(0)), 0), ev(`passday:${second.id}:${dayFor(1)}`, noon(dayFor(1)), 0, false)];
    expect(ranksReached(football, done, events)[0].day).toBe(dayFor(0));
  });
  it("has no date when the ledger holds no markers", () => {
    expect(ranksReached(football, new Set(skillIds(football.levels[1].at)), [])[1].day).toBeNull();
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
