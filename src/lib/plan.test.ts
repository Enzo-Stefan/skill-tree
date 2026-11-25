import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import type { Skill } from "../types";
import { validateTree } from "./progress";
import { buildWeekPlan, cleanDayMinutes, cleanRestDays, DEFAULT_DAY_MINUTES, loadRestDays, saveRestDays, skillsToPlan, trainedPlanDays } from "./plan";

const skill = (id: string) => football.skills.find((s) => s.id === id)!;
// 2026-11-25 is a Wednesday; its week runs Monday 2026-11-23 to Sunday 2026-11-29.
const WEDNESDAY = "2026-11-25";

/** A made-up skill with a routine, for testing the planner on its own. */
const fake = (id: string, sessionsPerWeek: number, minutes: number, heavy = false): Skill => ({
  id,
  branch: null,
  name: id,
  requires: [],
  x: 0,
  row: 0,
  drill: "d",
  test: "1",
  tip: "t",
  routine: {
    warmUp: "w",
    coolDown: "c",
    exercises: [{ name: "e", howTo: "h", sets: { all: 1 }, reps: { all: 1 }, restSeconds: 0 }],
    sessionsPerWeek,
    minutes: { all: minutes },
    heavy,
  },
});

describe("routines in the football tree", () => {
  it("every skill has one, and they all pass the checker", () => {
    expect(football.skills.every((s) => s.routine)).toBe(true);
    expect(validateTree(football)).toEqual([]);
  });

  it("the checker catches empty fields, a missing level and reps-and-seconds together", () => {
    const r = skill("bc1").routine!;
    const broken = {
      ...football,
      skills: football.skills.map((s) =>
        s.id === "bc1"
          ? {
              ...s,
              routine: {
                ...r,
                warmUp: " ",
                minutes: { beginner: 20 },
                exercises: [{ ...r.exercises[0], reps: { beginner: 5, intermediate: 5, advanced: 5, expert: 5 } }],
              },
            }
          : s,
      ),
    };
    const errors = validateTree(broken);
    expect(errors).toContain("bc1: routine warm-up is empty");
    expect(errors).toContain("bc1: routine minutes has no value for intermediate, advanced, expert");
    expect(errors).toContain("bc1: routine exercise 1 needs reps or seconds, not both or neither");
  });

  it("the checker catches a tree where only some skills have a routine", () => {
    const half = { ...football, skills: football.skills.map((s) => (s.id === "sh5" ? { ...s, routine: undefined } : s)) };
    expect(validateTree(half)).toContain("sh5: has no routine, but other skills in this tree do");
  });
});

describe("what to plan", () => {
  it("is the unlocked skills that aren't passed yet", () => {
    expect(skillsToPlan(football, new Set()).map((s) => s.id)).toEqual(["root"]);
    const ids = skillsToPlan(football, new Set(["root"])).map((s) => s.id);
    expect(ids).toEqual(["bc1", "ps1", "dr1", "sh1", "df1", "ft1"]);
  });

  it("adds skills the player put in the plan themselves, but never passed ones", () => {
    expect(skillsToPlan(football, new Set(["root"]), ["sh5", "root"]).map((s) => s.id)).toContain("sh5");
    expect(skillsToPlan(football, new Set(["root"]), ["root"]).map((s) => s.id)).not.toContain("root");
  });
});

describe("the week plan", () => {
  it("runs Monday to Sunday of the given week", () => {
    const plan = buildWeekPlan([], null, WEDNESDAY);
    expect(plan.days.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
  });

  it("gives each skill its sessions on different days, spread out", () => {
    const plan = buildWeekPlan([fake("a", 3, 20)], null, WEDNESDAY);
    const daysWithA = plan.days.flatMap((d, i) => (d.items.some((it) => it.skillId === "a") ? [i] : []));
    expect(daysWithA).toHaveLength(3);
    // Three sessions in seven days: at least two days apart.
    for (let i = 1; i < daysWithA.length; i++) expect(daysWithA[i] - daysWithA[i - 1]).toBeGreaterThanOrEqual(2);
  });

  it("keeps every day under the limit, and lists what didn't fit", () => {
    const plan = buildWeekPlan([fake("a", 7, 40), fake("b", 7, 30)], null, WEDNESDAY, 60);
    for (const d of plan.days) expect(d.minutes).toBeLessThanOrEqual(60);
    // Six training days (Sunday is rest): "a" fits on all six, "b" never fits next to it.
    expect(plan.unplaced.length).toBe(8);
    expect(plan.days.reduce((n, d) => n + d.items.length, 0) + plan.unplaced.length).toBe(14);
  });

  it("never puts heavy sessions on back-to-back days", () => {
    const plan = buildWeekPlan([fake("run", 3, 30, true), fake("sprint", 3, 20, true)], null, WEDNESDAY, 90);
    const heavyDays = plan.days.map((d) => d.items.some((it) => it.heavy));
    for (let i = 1; i < 7; i++) expect(heavyDays[i] && heavyDays[i - 1]).toBe(false);
    // They share the heavy days instead of blocking each other, so all six sessions fit.
    expect(plan.unplaced).toEqual([]);
  });

  it("uses the player's level for each session's length", () => {
    const bc1 = skill("bc1");
    const beginner = buildWeekPlan([bc1], "beginner", WEDNESDAY);
    const expert = buildWeekPlan([bc1], "expert", WEDNESDAY);
    const minutesOf = (p: typeof beginner) => p.days.flatMap((d) => d.items).map((it) => it.minutes);
    expect(new Set(minutesOf(beginner))).toEqual(new Set([15]));
    expect(new Set(minutesOf(expert))).toEqual(new Set([25]));
  });

  it("plans a real first week after First Touch without breaking any rule", () => {
    const plan = buildWeekPlan(skillsToPlan(football, new Set(["root"])), "beginner", WEDNESDAY);
    for (const d of plan.days) expect(d.minutes).toBeLessThanOrEqual(DEFAULT_DAY_MINUTES);
    const heavyDays = plan.days.map((d) => d.items.some((it) => it.heavy));
    for (let i = 1; i < 7; i++) expect(heavyDays[i] && heavyDays[i - 1]).toBe(false);
    // The 3 km run (ft1) is the only heavy skill here and needs 3 sessions: all fit.
    expect(plan.days.filter((d) => d.items.some((it) => it.skillId === "ft1"))).toHaveLength(3);
  });

  it("is the same every time for the same input", () => {
    const skills = skillsToPlan(football, new Set(["root"]));
    expect(buildWeekPlan(skills, "advanced", WEDNESDAY)).toEqual(buildWeekPlan(skills, "advanced", WEDNESDAY));
  });
});

describe("fairness and spreading", () => {
  it("gives every skill a session before any skill gets a second", () => {
    // Six training days with room for one 50-minute session each. "many" wants all six, so if it
    // went first "few" would get nothing; round by round, "few" gets its one session.
    const plan = buildWeekPlan([fake("many", 6, 50), fake("few", 1, 50)], null, WEDNESDAY, 60);
    const placed = plan.days.flatMap((d) => d.items.map((it) => it.skillId));
    expect(placed.filter((id) => id === "few")).toHaveLength(1);
    expect(placed.filter((id) => id === "many")).toHaveLength(5);
    expect(plan.unplaced.map((u) => u.skillId)).toEqual(["many"]);
  });

  it("spreads a skill's sessions even when the daily limit is high", () => {
    // A heavy day early in the week shouldn't pull a light skill's sessions next to each other.
    const plan = buildWeekPlan([fake("long", 1, 170), fake("a", 2, 10)], null, WEDNESDAY, 180);
    const daysWithA = plan.days.flatMap((d, i) => (d.items.some((it) => it.skillId === "a") ? [i] : []));
    expect(daysWithA[1] - daysWithA[0]).toBeGreaterThanOrEqual(3);
  });
});

describe("rest days", () => {
  it("keeps Sunday free by default, even when skills want every day", () => {
    const plan = buildWeekPlan([fake("a", 7, 10), fake("b", 7, 10)], null, WEDNESDAY);
    expect(plan.days[6].rest).toBe(true);
    expect(plan.days[6].items).toEqual([]);
    expect(plan.days.slice(0, 6).every((d) => !d.rest && d.items.length === 2)).toBe(true);
    expect(plan.unplaced).toHaveLength(2);
  });

  it("can rest on other days the player picks", () => {
    const plan = buildWeekPlan([fake("a", 7, 10)], null, WEDNESDAY, 60, [2, 5]);
    expect(plan.days.map((d) => d.rest)).toEqual([false, false, true, false, false, true, false]);
    expect(plan.days[2].items).toEqual([]);
    expect(plan.days[5].items).toEqual([]);
  });

  it("always keeps at least one rest day and one training day", () => {
    expect(cleanRestDays([])).toEqual([6]);
    expect(cleanRestDays("sunday")).toEqual([6]);
    expect(cleanRestDays([3, 3, 9, -1, 1.5])).toEqual([3]);
    expect(cleanRestDays([0, 1, 2, 3, 4, 5, 6])).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("a real first week keeps its rest day and lists what didn't fit instead of going over the limit", () => {
    const skills = skillsToPlan(football, new Set(["root"]));
    const plan = buildWeekPlan(skills, "beginner", WEDNESDAY);
    expect(plan.days[6].items).toEqual([]);
    for (const d of plan.days) expect(d.minutes).toBeLessThanOrEqual(DEFAULT_DAY_MINUTES);
    const wanted = skills.reduce((n, s) => n + s.routine!.sessionsPerWeek, 0);
    expect(plan.days.reduce((n, d) => n + d.items.length, 0) + plan.unplaced.length).toBe(wanted);
  });

  it("remembers the rest days the player picks", () => {
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    try {
      expect(loadRestDays()).toEqual([6]);
      saveRestDays([5, 2]);
      expect(loadRestDays()).toEqual([2, 5]);
      store.set("skill-tree:plan-rest-days", "not json");
      expect(loadRestDays()).toEqual([6]);
    } finally {
      globalThis.localStorage = real;
    }
  });
});

describe("the day limit and done days", () => {
  it("drops heavy sessions that can't avoid back-to-back days, rather than break the rule", () => {
    // A heavy skill that asks for a session every day: heavy days can't touch, so some can't go in.
    const plan = buildWeekPlan([fake("a", 7, 10, true)], null, WEDNESDAY);
    const heavyDays = plan.days.map((d) => d.items.length > 0);
    for (let i = 1; i < 7; i++) expect(heavyDays[i] && heavyDays[i - 1]).toBe(false);
    expect(plan.unplaced.length).toBeGreaterThan(0);
    expect(heavyDays.filter(Boolean).length + plan.unplaced.length).toBe(7);
  });

  it("keeps the daily limit sensible", () => {
    expect(cleanDayMinutes(45)).toBe(45);
    expect(cleanDayMinutes(5)).toBe(15);
    expect(cleanDayMinutes(999)).toBe(180);
    expect(cleanDayMinutes("abc")).toBe(DEFAULT_DAY_MINUTES);
  });

  it("marks planned days the player trained on", () => {
    const plan = buildWeekPlan([fake("a", 2, 20)], null, WEDNESDAY);
    const planned = plan.days.filter((d) => d.items.length).map((d) => d.date);
    expect(trainedPlanDays(plan, [planned[0], "2026-11-01"])).toEqual([planned[0]]);
  });
});
