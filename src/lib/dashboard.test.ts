import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import type { WeekPlan } from "./plan";
import type { Season } from "../data/seasons";
import { challengeCards, branchShares, continueTarget, daySessions, recentActivity, weekSessionCount } from "./dashboard";
import { dailyChallenge, weeklyChallenge, type ChallengeContext } from "./challenges";
import { exerciseTickKey } from "./missions";

const withRoutine = football.skills.filter((s) => s.routine && s.routine.exercises.length > 0);
const a = withRoutine[0]!;
const b = withRoutine[1]!;
const day = (date: string, ids: string[], rest = false) => ({ date, rest, items: ids.map((skillId) => ({ skillId, minutes: 10, heavy: false })), minutes: 10 * ids.length });
const plan: WeekPlan = { days: [day("2026-11-23", [a.id]), day("2026-11-24", [a.id, b.id]), day("2026-11-25", [], true)], unplaced: [] };
const allTicks = (date: string, skill: typeof a) => skill.routine!.exercises.map((_, i) => exerciseTickKey(date, skill.id, i));

describe("branchShares", () => {
  it("counts finished skills per branch", () => {
    const first = football.skills.find((s) => s.branch === football.branches[0]!.id)!;
    const shares = branchShares(football, new Set([first.id]));
    expect(shares).toHaveLength(football.branches.length);
    expect(shares[0]!.done).toBe(1);
    expect(shares[0]!.total).toBeGreaterThan(0);
    expect(shares[1]!.done).toBe(0);
  });
});

describe("daySessions", () => {
  it("is empty on a rest day or a day outside the plan", () => {
    expect(daySessions(football, plan, new Set(), "2026-11-25")).toEqual([]);
    expect(daySessions(football, plan, new Set(), "2030-01-01")).toEqual([]);
  });
  it("marks a session done only when every exercise is ticked", () => {
    const ticks = new Set(allTicks("2026-11-24", a).slice(1));
    expect(daySessions(football, plan, ticks, "2026-11-24").map((s) => s.done)).toEqual([false, false]);
    allTicks("2026-11-24", a).forEach((k) => ticks.add(k));
    expect(daySessions(football, plan, ticks, "2026-11-24").map((s) => s.done)).toEqual([true, false]);
  });
});

describe("weekSessionCount", () => {
  it("counts planned and finished sessions across the week", () => {
    expect(weekSessionCount(football, plan, new Set(allTicks("2026-11-23", a)))).toEqual({ done: 1, total: 3 });
  });
});

describe("recentActivity", () => {
  const ev = (key: string, active = true) => ({ key, xp: 0, active, at: "2026-11-20T00:00:00.000Z" });
  it("lists newest first, passes before sessions on a day, and honours the limit", () => {
    const items = recentActivity(
      football,
      [{ date: "2026-11-20", skillId: a.id }, { date: "2026-11-22", skillId: b.id }],
      [ev(`passday:${a.id}:2026-11-22`), ev(`passday:${b.id}:2026-11-01`, false)],
    );
    expect(items.map((i) => `${i.kind}:${i.date}`)).toEqual(["pass:2026-11-22", "session:2026-11-22", "session:2026-11-20"]);
    expect(recentActivity(football, [{ date: "2026-11-20", skillId: a.id }, { date: "2026-11-22", skillId: b.id }], [], 1)).toHaveLength(1);
  });
  it("drops skills the tree does not have", () => {
    expect(recentActivity(football, [{ date: "2026-11-20", skillId: "gone" }], [ev("passday:gone:2026-11-20")])).toEqual([]);
  });
});

describe("continueTarget", () => {
  it("opens today's first unfinished session", () => {
    const ticks = new Set(allTicks("2026-11-24", a));
    expect(continueTarget(football, plan, ticks, new Set(), "2026-11-24")).toEqual({ kind: "session", skillId: b.id });
  });
  it("falls back to the next skill when nothing is planned or all is done", () => {
    const target = continueTarget(football, plan, new Set(), new Set(), "2026-11-25");
    expect(target?.kind).toBe("skill");
    const ticks = new Set([...allTicks("2026-11-24", a), ...allTicks("2026-11-24", b)]);
    expect(continueTarget(football, plan, ticks, new Set(), "2026-11-24")?.kind).toBe("skill");
  });
  it("is null when every skill is done", () => {
    expect(continueTarget(football, plan, new Set(), new Set(football.skills.map((s) => s.id)), "2026-11-25")).toBeNull();
  });
});

describe("challengeCards", () => {
  const season: Season = {
    id: "s1",
    title: "Test Season",
    start: "2026-11-01",
    end: "2026-11-30",
    challenges: [{ id: "s1-days2", goal: { kind: "trainDays", count: 2 }, title: "Two days", text: "Train on 2 days." }],
  };
  const empty: ChallengeContext = { practiceDays: [], sessions: [], passDays: [] };

  it("gives the day's challenge, the week's challenge and no season outside one", () => {
    const cards = challengeCards("2026-12-01", empty, [season]);
    expect(cards.map((c) => c.kind)).toEqual(["daily", "weekly"]);
    expect(cards[0]!.id).toBe(dailyChallenge("2026-12-01").id);
    expect(cards[1]!.id).toBe(weeklyChallenge("2026-12-01").id);
    expect(cards.every((c) => c.have === 0 && !c.done)).toBe(true);
  });

  it("adds the active season's challenges with progress over the season", () => {
    const ctx: ChallengeContext = { ...empty, practiceDays: ["2026-11-03", "2026-11-03", "2026-10-30"] };
    const cards = challengeCards("2026-11-10", ctx, [season]);
    const s = cards.find((c) => c.kind === "season")!;
    expect(s).toMatchObject({ id: "s1-days2", have: 1, need: 2, done: false, seasonId: "s1", seasonTitle: "Test Season" });
  });

  it("marks a challenge done and caps progress at its goal", () => {
    const ctx: ChallengeContext = { ...empty, practiceDays: ["2026-11-03", "2026-11-04", "2026-11-05"] };
    const s = challengeCards("2026-11-10", ctx, [season]).find((c) => c.kind === "season")!;
    expect(s).toMatchObject({ have: 2, need: 2, done: true });
  });

  it("counts today's training toward the daily challenge", () => {
    // Find a day whose daily challenge is "train today", so the test does not depend on the rotation.
    const day = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`).find((d) => dailyChallenge(d).goal.kind === "trainDay")!;
    const trained: ChallengeContext = { ...empty, practiceDays: [day] };
    const daily = challengeCards(day, trained, []).find((c) => c.kind === "daily")!;
    expect(daily).toMatchObject({ have: 1, need: 1, done: true });
  });
});
