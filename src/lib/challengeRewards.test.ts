import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import type { Season } from "../data/seasons";
import { XP_AMOUNTS } from "../data/xp";
import { dailyChallenge, weeklyChallenge, challengeAwardKey } from "./challenges";
import { applyChallengeRewards, applyMissionRewards, passDaysFromLedger } from "./challengeRewards";
import { completedMissionKeys, exerciseTickKey } from "./missions";
import { buildWeekPlan, skillsToPlan } from "./plan";
import { amountFor, award, skillPassKey, totalXp, type XpEvent } from "./xp";

const TODAY = "2026-11-26";
const NOW = "2026-11-26T12:00:00.000Z";
const input = (over: Partial<Parameters<typeof applyChallengeRewards>[1]> = {}) => ({ practiceDays: [], sessions: [], today: TODAY, ...over });

/** A ledger where a skill was passed at a time that is the given local day at noon, whatever the machine's time zone. */
const passedOn = (skillId: string, y: number, m: number, d: number): XpEvent => ({ key: skillPassKey(skillId), xp: 100, active: true, at: new Date(y, m - 1, d, 12).toISOString() });

describe("passDaysFromLedger", () => {
  it("lists the local days of active skill passes only", () => {
    const off: XpEvent = { ...passedOn("bc2", 2026, 11, 25), active: false };
    const other: XpEvent = { key: "session:2026-11-26", xp: 40, active: true, at: NOW };
    expect(passDaysFromLedger([passedOn("bc1", 2026, 11, 26), off, other])).toEqual(["2026-11-26"]);
  });
});

describe("daily and weekly challenges", () => {
  const daily = dailyChallenge(TODAY);
  const weekly = weeklyChallenge(TODAY);

  it("pays nothing when nothing was done", () => {
    expect(applyChallengeRewards([], input(), NOW, [])).toEqual([]);
  });

  it("pays today's daily challenge once it is done, and only once", () => {
    // Whatever today's challenge asks, give the player enough of everything.
    const days = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"];
    const sessions = ["bc1", "bc2", "bc3", "bc4"].map((skillId) => ({ date: TODAY, skillId }));
    const passes = [passedOn("bc1", 2026, 11, 26), passedOn("bc2", 2026, 11, 26)];
    const once = applyChallengeRewards(passes, input({ practiceDays: days, sessions }), NOW, []);
    expect(once.some((e) => e.key === challengeAwardKey(daily, TODAY))).toBe(true);
    expect(once.some((e) => e.key === challengeAwardKey(weekly, TODAY))).toBe(true);
    const again = applyChallengeRewards(once, input({ practiceDays: days, sessions }), "2026-11-26T18:00:00.000Z", []);
    expect(again).toBe(once);
    expect(totalXp(once) - totalXp(passes)).toBe(XP_AMOUNTS.challengeDaily + XP_AMOUNTS.challengeWeekly);
  });

  it("looks only at today's day and week, so a challenge missed earlier cannot be earned later", () => {
    const sessions = ["bc1", "bc2", "bc3", "bc4"].map((skillId) => ({ date: "2026-11-10", skillId }));
    const old = applyChallengeRewards([passedOn("bc1", 2026, 11, 10), passedOn("bc2", 2026, 11, 10)], input({ practiceDays: ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"], sessions }), NOW, []);
    expect(old.every((e) => e.key.startsWith("skill:"))).toBe(true);
  });
});

describe("seasonal challenges", () => {
  const season: Season = {
    id: "s1",
    title: "S",
    start: "2026-11-01",
    end: "2026-12-31",
    challenges: [{ id: "s-days", goal: { kind: "trainDays", count: 3 }, title: "Days", text: "" }],
  };

  it("pays a season challenge once, worth the seasonal amount, when the season is running", () => {
    const days = ["2026-11-03", "2026-11-10", "2026-11-26"];
    const once = applyChallengeRewards([], input({ practiceDays: days }), NOW, [season]);
    expect(once.find((e) => e.key === "challenge:s-days:season-s1")?.xp).toBe(XP_AMOUNTS.challengeSeason);
    expect(applyChallengeRewards(once, input({ practiceDays: days }), NOW, [season])).toBe(once);
  });

  it("pays nothing outside the season or before the goal is met", () => {
    expect(applyChallengeRewards([], input({ practiceDays: ["2026-11-03", "2026-11-10"] }), NOW, [season]).some((e) => e.key.includes("season"))).toBe(false);
    expect(applyChallengeRewards([], input({ today: "2027-01-05", practiceDays: ["2026-11-03", "2026-11-10", "2026-11-26"] }), NOW, [season]).some((e) => e.key.includes("season"))).toBe(false);
  });
});

describe("missions from the Training screen's ticks", () => {
  const done = new Set<string>(["root"]);
  // Any day with a planned session works: take the first one in this week's plan.
  const plan = buildWeekPlan(skillsToPlan(football, done), "beginner", TODAY, 120, [6]);
  const day = plan.days.find((d) => d.items.length > 0)!;
  const item = day.items[0]!;
  const exercises = football.skills.find((s) => s.id === item.skillId)!.routine!.exercises;
  const allTicks = new Set(exercises.map((_, i) => exerciseTickKey(day.date, item.skillId, i)));

  it("completes a session only when every exercise of it is ticked", () => {
    expect(completedMissionKeys(football, plan, new Set(), day.date)).toEqual([]);
    const missingOne = new Set(allTicks);
    missingOne.delete(exerciseTickKey(day.date, item.skillId, 0));
    expect(completedMissionKeys(football, plan, missingOne, day.date)).not.toContain(`mission:${day.date}:${item.skillId}`);
    expect(completedMissionKeys(football, plan, allTicks, day.date)).toContain(`mission:${day.date}:${item.skillId}`);
  });

  it("never completes on another day, a rest day, or from yesterday's ticks", () => {
    const other = plan.days.find((d) => d.date !== day.date)!;
    expect(completedMissionKeys(football, plan, allTicks, other.date).some((k) => k.includes(`:${item.skillId}`) && k.includes(day.date))).toBe(false);
    expect(completedMissionKeys(football, plan, allTicks, "2030-01-01")).toEqual([]);
  });

  it("pays the mission amount once, however often it runs, and again is a no-op", () => {
    const keys = completedMissionKeys(football, plan, allTicks, day.date);
    const once = applyMissionRewards([], keys, NOW);
    expect(totalXp(once)).toBe(keys.length * XP_AMOUNTS.mission);
    expect(applyMissionRewards(once, keys, "2026-11-26T18:00:00.000Z")).toBe(once);
    expect(amountFor(keys[0]!)).toBe(XP_AMOUNTS.mission);
  });

  it("ignores a mission key it cannot price", () => {
    expect(applyMissionRewards([], ["mission"], NOW)).toEqual([]);
    expect(award([], "nonsense", 10, NOW)).toEqual([]);
  });
});
