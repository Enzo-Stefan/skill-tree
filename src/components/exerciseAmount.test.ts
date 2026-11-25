import { describe, expect, it } from "vitest";
import { exerciseAmount } from "./exerciseAmount";
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
