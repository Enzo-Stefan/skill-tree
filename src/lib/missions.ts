import type { PerLevel, RoutineExercise, Skill, Tree } from "../types";
import { forLevel } from "./progress";
import type { PlanItem } from "./plan";
import { missionKey } from "./xp";

// Missions (#126): one planned session turned into steps the player ticks off: warm-up, each exercise,
// cool-down. Ticking every step completes the mission, and completing it pays XP once (an event key per day
// and skill, src/lib/xp.ts). The estimated time and the difficulty label come from the routine's numbers.

/** Seconds a repetition takes when the routine does not say, for working out time. */
export const SECONDS_PER_REP = 3;
/** Fallback minutes for a warm-up or a cool-down when the text gives no number. */
const DEFAULT_PAUSE_MINUTES = 5;

export type Difficulty = "easy" | "medium" | "hard";

export interface MissionStep {
  kind: "warmUp" | "exercise" | "coolDown";
  /** The exercise's name; absent for the warm-up and cool-down. */
  name?: string;
  /** What to do: the exercise's how-to, or the warm-up and cool-down text. */
  text: string;
  /** Sets and what each set is, for an exercise. */
  sets?: number;
  reps?: number;
  seconds?: number;
  restSeconds?: number;
  /** Estimated minutes for the step. */
  minutes: number;
  difficulty?: Difficulty;
}

export interface Mission {
  /** Stable for a day and skill: the key progress and the XP award use. */
  id: string;
  date: string;
  skillId: string;
  title: string;
  steps: MissionStep[];
  /** Estimated minutes for the whole mission (sum of the steps). */
  minutes: number;
  difficulty: Difficulty;
  heavy: boolean;
}

/** A number of minutes from "5 minutes" or "8 to 10 minutes" in a warm-up text: the smaller number. */
export function minutesInText(text: string): number {
  const m = /(\d+)(?:\s*(?:to|-|–)\s*\d+)?\s*(?:min|minute|minutes)\b/i.exec(text);
  return m ? Number(m[1]) : DEFAULT_PAUSE_MINUTES;
}

/**
 * Estimated minutes for one exercise at a level: each set takes its seconds (or reps x SECONDS_PER_REP),
 * with the rest between sets. Rounded up to a whole minute, at least 1.
 */
export function exerciseMinutes(ex: RoutineExercise, levelId: string | null): number {
  const sets = forLevel(ex.sets, levelId) ?? 1;
  const seconds = ex.seconds ? forLevel(ex.seconds, levelId) : null;
  const reps = ex.reps ? forLevel(ex.reps, levelId) : null;
  const perSet = seconds ?? (reps ?? 0) * SECONDS_PER_REP;
  const total = sets * perSet + Math.max(0, sets - 1) * ex.restSeconds;
  return Math.max(1, Math.ceil(total / 60));
}

/** Easy under 4 minutes, medium under 8, hard from 8: how much work an exercise is. */
export function exerciseDifficulty(minutes: number): Difficulty {
  return minutes < 4 ? "easy" : minutes < 8 ? "medium" : "hard";
}

/** Easy up to 20 minutes, medium up to 35, hard above that; a heavy session (sprints, runs) is at least medium. */
export function missionDifficulty(minutes: number, heavy: boolean): Difficulty {
  const base: Difficulty = minutes <= 20 ? "easy" : minutes <= 35 ? "medium" : "hard";
  return heavy && base === "easy" ? "medium" : base;
}

const levelsOf = (p: PerLevel | undefined, levelId: string | null) => (p ? forLevel(p, levelId) ?? undefined : undefined);

/** The mission for one planned session, or null when the skill has no routine. */
export function buildMission(tree: Tree, item: PlanItem, date: string, levelId: string | null): Mission | null {
  const skill: Skill | undefined = tree.skills.find((s) => s.id === item.skillId);
  const routine = skill?.routine;
  if (!skill || !routine) return null;
  const steps: MissionStep[] = [
    { kind: "warmUp", text: routine.warmUp, minutes: minutesInText(routine.warmUp) },
    ...routine.exercises.map((ex): MissionStep => {
      const minutes = exerciseMinutes(ex, levelId);
      return {
        kind: "exercise",
        name: ex.name,
        text: ex.howTo,
        sets: levelsOf(ex.sets, levelId),
        reps: levelsOf(ex.reps, levelId),
        seconds: levelsOf(ex.seconds, levelId),
        restSeconds: ex.restSeconds,
        minutes,
        difficulty: exerciseDifficulty(minutes),
      };
    }),
    { kind: "coolDown", text: routine.coolDown, minutes: minutesInText(routine.coolDown) },
  ];
  const minutes = steps.reduce((sum, s) => sum + s.minutes, 0);
  const heavy = Boolean(routine.heavy);
  return { id: `${date}:${skill.id}`, date, skillId: skill.id, title: skill.name, steps, minutes, difficulty: missionDifficulty(minutes, heavy), heavy };
}

// ---- Ticking steps ----

/** For each mission id, the indexes of the steps the player has ticked. */
export type MissionTicks = Record<string, number[]>;

/** The ticks with one step switched on or off. Out-of-range steps are ignored. */
export function toggleStep(ticks: MissionTicks, mission: Mission, step: number): MissionTicks {
  if (!Number.isInteger(step) || step < 0 || step >= mission.steps.length) return ticks;
  const current = new Set(ticks[mission.id] ?? []);
  if (current.has(step)) current.delete(step);
  else current.add(step);
  return { ...ticks, [mission.id]: [...current].sort((a, b) => a - b) };
}

export function stepsDone(ticks: MissionTicks, mission: Mission): number {
  return new Set((ticks[mission.id] ?? []).filter((i) => i >= 0 && i < mission.steps.length)).size;
}

/** A mission is complete when every step is ticked. */
export function missionComplete(ticks: MissionTicks, mission: Mission): boolean {
  return mission.steps.length > 0 && stepsDone(ticks, mission) === mission.steps.length;
}

/** The XP event key for a mission: one award per day and skill. */
export function missionAwardKey(mission: Mission): string {
  return missionKey(mission.date, mission.skillId);
}

/** Drops ticks for missions that are not in `missions` (an old week), and bad numbers. */
export function cleanTicks(raw: unknown, missions: Mission[]): MissionTicks {
  if (typeof raw !== "object" || raw === null) return {};
  const out: MissionTicks = {};
  for (const m of missions) {
    const list = (raw as Record<string, unknown>)[m.id];
    if (!Array.isArray(list)) continue;
    const steps = [...new Set(list.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < m.steps.length))].sort((a, b) => a - b);
    if (steps.length) out[m.id] = steps;
  }
  return out;
}
