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

describe("XP per week", () => {
  const events = [
    ev("session:2026-11-03", "2026-11-03T12:00:00", 40),
    ev("mission:2026-11-04:bc1", "2026-11-04T12:00:00", 60),
    ev("session:2026-11-10", "2026-11-10T12:00:00", 40),
    ev("session:2026-11-11", "2026-11-11T12:00:00", 40, false),
  ];
  it("sums active events per week with empty weeks as 0", () => {
    const weeks = xpPerWeek(events, "2026-11-12", 3);
    expect(weeks.map((w) => w.week)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(weeks.map((w) => w.xp)).toEqual([0, 100, 40]);
    expect(weeks.some((w) => w.undated)).toBe(false);
  });
  it("counts earned missions only", () => expect(missionsCompleted(events)).toBe(1));
  it("places a day-keyed event in the week of its own day, not the week its entry last changed", () => {
    const backfill = [ev("session:2026-11-03", noon("2026-11-26"), 40)];
    const weeks = xpPerWeek(backfill, "2026-11-26", 4);
    expect(weeks.map((w) => w.week)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(weeks.map((w) => w.xp)).toEqual([40, 0, 0, 0]);
  });
  it("places a backfilled skill pass in the week of its first-pass marker", () => {
    const backfill = [ev("passday:bc1:2026-11-03", noon("2026-11-03"), 0), ev("skill:bc1:pass", noon("2026-11-26"), 40)];
    expect(xpPerWeek(backfill, "2026-11-26", 4).map((w) => w.xp)).toEqual([40, 0, 0, 0]);
  });
  it("places a pass that was undone and redone in the week of its first pass", () => {
    const redone = [ev("passday:bc1:2026-11-02", noon("2026-11-02"), 0, false), ev("skill:bc1:pass", "2026-11-16T12:00:00", 10)];
    const weeks = xpPerWeek(redone, "2026-11-18", 3);
    expect(weeks.map((w) => w.week)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(weeks.map((w) => w.xp)).toEqual([10, 0, 0]);
  });
  it("counts a daily and a weekly challenge in their own week and marks a season challenge as undated", () => {
    const awards = [
      ev("challenge:daily-a:2026-11-08", "2026-11-20T12:00:00", 10),
      ev("challenge:weekly-b:2026-11-09", "2026-11-20T12:00:00", 25),
      ev("challenge:c1:season-s1", noon("2026-11-12"), 30),
    ];
    const weeks = xpPerWeek(awards, "2026-11-12", 2);
    expect(weeks.map((w) => w.xp)).toEqual([10, 55]);
    expect(weeks.map((w) => w.undated)).toEqual([false, true]);
  });
  it("puts a pass with no marker in the week its entry last changed and flags it as undated", () => {
    const backfill = [ev("skill:bc1:pass", noon("2026-11-12"), 10), ev("skill:bc2:pass", noon("2026-11-12"), 10), ev("skill:bc3:pass", noon("2026-11-12"), 20)];
    const weeks = xpPerWeek(backfill, "2026-11-12", 3);
    expect(weeks.map((w) => w.xp)).toEqual([0, 0, 40]);
    expect(weeks.map((w) => w.undated)).toEqual([false, false, true]);
  });
  it("uses local days at the week boundary", () => {
    const edge = [ev("session:2026-11-08", "2026-11-08T12:00:00", 10), ev("session:2026-11-09", "2026-11-09T12:00:00", 10)];
    expect(xpPerWeek(edge, "2026-11-12", 2).map((w) => w.xp)).toEqual([10, 10]);
    const timed = [ev("skill:bc3:pass", "2026-11-08T23:30:00", 10), ev("skill:bc4:pass", "2026-11-09T00:30:00", 10)];
    expect(xpPerWeek(timed, "2026-11-12", 2).map((w) => w.xp)).toEqual([10, 10]);
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
  it("shows the starting rank as before tracking, even with every pass marked", () => {
    const [first] = football.skills;
    const ranks = ranksReached(football, new Set([first.id]), [ev(`passday:${first.id}:${dayFor(0)}`, noon(dayFor(0)), 0)]);
    expect(ranks[0]).toEqual({ name: football.levels[0].name, day: null });
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
  it("keeps the first-pass day of a pass that was undone and redone", () => {
    const second = football.levels[1];
    // Only the first pass has a marker, and an undo switched it off; the redo put the skill back as done.
    const events = [ev(`passday:${football.skills[0].id}:${dayFor(0)}`, noon(dayFor(0)), 0, false)];
    const ranks = ranksReached(football, new Set(skillIds(second.at)), events);
    expect(ranks[1].day).toBe(dayFor(0));
  });
  it("ignores markers for skills that are not done", () => {
    const second = football.levels[1];
    const ids = skillIds(second.at);
    const events = [...ids.map((id, i) => ev(`passday:${id}:${dayFor(i)}`, noon(dayFor(i)), 0)), ev(`passday:${football.skills[second.at].id}:2026-10-01`, noon("2026-10-01"), 0)];
    expect(ranksReached(football, new Set(ids), events)[1].day).toBe(dayFor(second.at - 1));
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
