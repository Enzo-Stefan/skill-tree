import type { RoutineExercise } from "../types";
import { forLevel } from "../lib/progress";
import { t } from "../i18n";

/** "3 × 10 reps" or "3 × 45 s" for an exercise at the player's level. */
export function exerciseAmount(ex: RoutineExercise, levelId: string | null): string {
  const sets = forLevel(ex.sets, levelId) ?? 1;
  if (ex.seconds) return t.training.setsSeconds(sets, forLevel(ex.seconds, levelId) ?? 0);
  return t.training.setsReps(sets, ex.reps ? (forLevel(ex.reps, levelId) ?? 0) : 0);
}
