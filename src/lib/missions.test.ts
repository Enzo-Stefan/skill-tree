import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { weights } from "../data/weights";
import { XP_AMOUNTS } from "../data/xp";
import {
  buildMission,
  cleanTicks,
  exerciseDifficulty,
  exerciseMinutes,
  minutesInText,
  missionAwardKey,
  missionComplete,
  missionDifficulty,
  stepsDone,
  toggleStep,
  type MissionTicks,
} from "./missions";
import { amountFor, isEventKey } from "./xp";

const lv = (a: number, b: number, c: number, d: number) => ({ beginner: a, intermediate: b, advanced: c, expert: d });
const DAY = "2026-11-25";

describe("estimated time", () => {
  it("adds the sets and the rest between them, and counts reps at 3 seconds each", () => {
    // 3 sets x 10 reps x 3 s = 90 s, plus 2 rests of 45 s = 180 s = 3 minutes
    expect(exerciseMinutes({ name: "x", howTo: "", sets: lv(3, 3, 3, 3), reps: lv(10, 10, 10, 10), restSeconds: 45 }, "beginner")).toBe(3);
  });

  it("uses the seconds of a timed set and rounds up to a whole minute", () => {
    // 4 sets x 60 s + 3 rests x 30 s = 330 s -> 6 minutes
    expect(exerciseMinutes({ name: "x", howTo: "", sets: lv(4, 4, 4, 4), seconds: lv(60, 60, 60, 60), restSeconds: 30 }, "beginner")).toBe(6);
  });

  it("grows with the level when the routine's numbers do", () => {
    const ex = { name: "x", howTo: "", sets: lv(2, 3, 4, 5), reps: lv(10, 12, 15, 20), restSeconds: 30 };
    const [b, e] = [exerciseMinutes(ex, "beginner"), exerciseMinutes(ex, "expert")];
    expect(e).toBeGreaterThan(b);
  });

  it("is at least one minute, even for a single quick set", () => {
    expect(exerciseMinutes({ name: "x", howTo: "", sets: lv(1, 1, 1, 1), reps: lv(1, 1, 1, 1), restSeconds: 0 }, "beginner")).toBe(1);
  });

  it("reads minutes out of a warm-up text", () => {
    expect(minutesInText("5 minutes: easy jog")).toBe(5);
    expect(minutesInText("5 to 8 minutes: easy walk")).toBe(5);
    expect(minutesInText("8 minutes: jog")).toBe(8);
    expect(minutesInText("Just stretch")).toBe(5);
  });
});

describe("difficulty labels", () => {
  it("labels an exercise by its time", () => {
    expect([exerciseDifficulty(2), exerciseDifficulty(4), exerciseDifficulty(7), exerciseDifficulty(8), exerciseDifficulty(15)]).toEqual(["easy", "medium", "medium", "hard", "hard"]);
  });

  it("labels a mission by its time, and a heavy session is at least medium", () => {
    expect([missionDifficulty(15, false), missionDifficulty(20, false), missionDifficulty(30, false), missionDifficulty(50, false)]).toEqual(["easy", "easy", "medium", "hard"]);
    expect(missionDifficulty(15, true)).toBe("medium");
    expect(missionDifficulty(50, true)).toBe("hard");
  });
});

describe("buildMission", () => {
  const item = { skillId: "bc1", minutes: 20, heavy: false };

  it("makes a warm-up, one step per exercise, and a cool-down", () => {
    const m = buildMission(football, item, DAY, "beginner")!;
    const routine = football.skills.find((s) => s.id === "bc1")!.routine!;
    expect(m.steps.map((s) => s.kind)).toEqual(["warmUp", ...routine.exercises.map(() => "exercise"), "coolDown"]);
    expect(m.steps[1]).toMatchObject({ name: routine.exercises[0]!.name, text: routine.exercises[0]!.howTo });
    expect(m.id).toBe(`${DAY}:bc1`);
    expect(m.minutes).toBe(m.steps.reduce((sum, s) => sum + s.minutes, 0));
    expect(["easy", "medium", "hard"]).toContain(m.difficulty);
  });

  it("returns null for a skill with no routine or one the tree does not have", () => {
    expect(buildMission(football, { ...item, skillId: "ghost" }, DAY, null)).toBeNull();
    const noRoutine = { ...football, skills: football.skills.map((s) => (s.id === "bc1" ? { ...s, routine: undefined } : s)) };
    expect(buildMission(noRoutine, item, DAY, null)).toBeNull();
  });

  it("works for every skill with a routine in both trees, at every level, with sensible numbers", () => {
    for (const tree of [football, weights]) {
      for (const skill of tree.skills.filter((s) => s.routine)) {
        for (const level of ["beginner", "intermediate", "advanced", "expert"]) {
          const m = buildMission(tree, { skillId: skill.id, minutes: 20, heavy: false }, DAY, level)!;
          expect(m.minutes, `${tree.id} ${skill.id} ${level}`).toBeGreaterThan(0);
          expect(m.minutes, `${tree.id} ${skill.id} ${level}`).toBeLessThan(120);
          for (const step of m.steps.filter((s) => s.kind === "exercise")) {
            expect(step.sets, `${skill.id} ${step.name}`).toBeGreaterThan(0);
            expect(step.reps || step.seconds, `${skill.id} ${step.name}`).toBeTruthy();
          }
        }
      }
    }
  });
});

describe("ticking steps", () => {
  const mission = buildMission(football, { skillId: "bc1", minutes: 20, heavy: false }, DAY, "beginner")!;
  const n = mission.steps.length;

  it("completes only when every step is ticked, and un-ticking undoes it", () => {
    let ticks: MissionTicks = {};
    for (let i = 0; i < n - 1; i++) ticks = toggleStep(ticks, mission, i);
    expect(missionComplete(ticks, mission)).toBe(false);
    expect(stepsDone(ticks, mission)).toBe(n - 1);
    ticks = toggleStep(ticks, mission, n - 1);
    expect(missionComplete(ticks, mission)).toBe(true);
    ticks = toggleStep(ticks, mission, 0);
    expect(missionComplete(ticks, mission)).toBe(false);
  });

  it("ignores steps that do not exist, and ticking the same step twice switches it off", () => {
    const base: MissionTicks = {};
    expect(toggleStep(base, mission, -1)).toBe(base);
    expect(toggleStep(base, mission, n)).toBe(base);
    expect(toggleStep(base, mission, 1.5)).toBe(base);
    expect(toggleStep(toggleStep(base, mission, 1), mission, 1)[mission.id]).toEqual([]);
  });

  it("gives the same award key for the same day and skill, a valid one, worth the mission amount", () => {
    expect(missionAwardKey(mission)).toBe(`mission:${DAY}:bc1`);
    expect(isEventKey(missionAwardKey(mission))).toBe(true);
    expect(amountFor(missionAwardKey(mission))).toBe(XP_AMOUNTS.mission);
  });

  it("drops saved ticks for missions that are gone and for bad numbers", () => {
    const cleaned = cleanTicks({ [mission.id]: [0, 0, 2, 99, -1, "x", 1.5], "2020-01-01:old": [0] }, [mission]);
    expect(cleaned).toEqual({ [mission.id]: [0, 2] });
    expect(cleanTicks("nope", [mission])).toEqual({});
  });
});
