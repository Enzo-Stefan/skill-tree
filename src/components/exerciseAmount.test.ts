import { describe, expect, it } from "vitest";
import { duration, exerciseAmount, exerciseLine } from "./exerciseAmount";
import { es } from "../i18n/es";
import type { RoutineExercise } from "../types";

const reps: RoutineExercise = { name: "Wall pass", howTo: "x", sets: { beginner: 2, advanced: 4 }, reps: { beginner: 10, advanced: 20 }, restSeconds: 30 };
const timed: RoutineExercise = { name: "Juggle", howTo: "x", sets: { all: 3 }, seconds: { all: 45 }, restSeconds: 30 };

describe("exerciseAmount", () => {
  it("uses the player's level", () => {
    expect(exerciseAmount(reps, "beginner")).toBe("2 × 10 reps");
    expect(exerciseAmount(reps, "advanced")).toBe("4 × 20 reps");
  });
  it("says seconds for timed sets, and falls back to the first level with no level picked", () => {
    expect(exerciseAmount(timed, null)).toBe("3 × 45 s");
    expect(exerciseAmount(reps, null)).toBe("2 × 10 reps");
  });
});

describe("amounts as people say them", () => {
  const ex = (over: Partial<RoutineExercise>): RoutineExercise => ({ name: "x", howTo: "x", sets: { all: 1 }, restSeconds: 0, ...over });

  it("writes long sets in minutes", () => {
    expect(exerciseAmount(ex({ seconds: { all: 1200 } }), null)).toBe("20 min");
    expect(exerciseAmount(ex({ sets: { all: 3 }, seconds: { all: 180 } }), null)).toBe("3 × 3 min");
    expect(exerciseAmount(ex({ sets: { all: 2 }, seconds: { all: 90 } }), null)).toBe("2 × 1 min 30 s");
  });

  it("drops the × 1 for a single set or a single rep", () => {
    expect(exerciseAmount(ex({ reps: { all: 8 } }), null)).toBe("8 reps");
    expect(exerciseAmount(ex({ sets: { all: 2 }, reps: { all: 1 } }), null)).toBe("2 sets");
    expect(exerciseAmount(ex({ reps: { all: 1 } }), null)).toBe("1 rep");
  });

  it("leaves out the rest when there isn't any", () => {
    expect(exerciseLine(ex({ seconds: { all: 1200 } }), null)).toBe("20 min");
    expect(exerciseLine(ex({ sets: { all: 3 }, reps: { all: 10 }, restSeconds: 60 }), null)).toBe("3 × 10 reps · Rest 1 min");
  });

  it("writes the rest in minutes too once it reaches a minute", () => {
    expect(duration(120)).toBe("2 min");
    expect(exerciseLine(ex({ sets: { all: 2 }, reps: { all: 1 }, restSeconds: 120 }), null)).toBe("2 sets · Rest 2 min");
    expect(exerciseLine(ex({ sets: { all: 3 }, reps: { all: 10 }, restSeconds: 45 }), null)).toBe("3 × 10 reps · Rest 45 s");
  });

  it("has Spanish wording for the new strings", () => {
    expect(es.training.repsOnly(1)).toBe("1 repetición");
    expect(es.training.repsOnly(8)).toBe("8 repeticiones");
    expect(es.training.setsOnly(2)).toBe("2 series");
    expect(es.training.setsOf(3, duration(180))).toBe("3 × 3 min");
    expect(es.training.rest(duration(120))).toBe("Descanso 2 min");
    expect(es.training.startRest(duration(45))).toBe("Iniciar descanso de 45 s");
  });
});
