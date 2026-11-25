import type { RoutineExercise } from "../types";
import { forLevel } from "../lib/progress";
import { t } from "../i18n";

/** A whole number of seconds as "45 s", "20 min" or "1 min 30 s". The units are the same in every language. */
function duration(s: number): string {
  if (s < 60) return `${s} s`;
  return s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/**
 * How much of an exercise to do at the player's level, as people say it: "3 × 10 reps", "3 × 45 s",
 * "20 min" for one long set, "8 reps" for one set, "2 sets" for rounds of a circuit (one rep each).
 */
export function exerciseAmount(ex: RoutineExercise, levelId: string | null): string {
  const sets = forLevel(ex.sets, levelId) ?? 1;
  if (ex.seconds) {
    const time = duration(forLevel(ex.seconds, levelId) ?? 0);
    return sets === 1 ? time : t.training.setsOf(sets, time);
  }
  const reps = ex.reps ? (forLevel(ex.reps, levelId) ?? 0) : 0;
  if (sets === 1) return t.training.repsOnly(reps);
  if (reps === 1) return t.training.setsOnly(sets);
  return t.training.setsReps(sets, reps);
}

/** The amount, plus the rest between sets when there is one: "3 × 10 reps · Rest 60 s", or just "20 min". */
export function exerciseLine(ex: RoutineExercise, levelId: string | null): string {
  const amount = exerciseAmount(ex, levelId);
  return ex.restSeconds > 0 ? `${amount} · ${t.training.rest(ex.restSeconds)}` : amount;
}
