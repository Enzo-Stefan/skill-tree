import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import type { WeekPlan } from "./plan";
import { branchShares, continueTarget, daySessions, recentActivity, weekSessionCount } from "./dashboard";
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
