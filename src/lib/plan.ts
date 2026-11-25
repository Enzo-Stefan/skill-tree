import type { Skill, Tree } from "../types";
import { forLevel, skillState } from "./progress";
import { dayKey, weekOf, type DayKey } from "./streak";

// The weekly training plan (#80): from the skills a player is working on, spread each skill's
// routine sessions over the week, keep every day under a time limit, and never put two heavy
// sessions (sprints, runs) on back-to-back days.

/** Default time limit per day, in minutes. The player can change it. */
export const DEFAULT_DAY_MINUTES = 60;
export const MIN_DAY_MINUTES = 15;
export const MAX_DAY_MINUTES = 180;

/** One skill's session on a day. */
export interface PlanItem {
  skillId: string;
  minutes: number;
  heavy: boolean;
}

export interface PlanDay {
  date: DayKey;
  items: PlanItem[];
  /** Total minutes of the day's sessions. */
  minutes: number;
}

export interface WeekPlan {
  /** Monday to Sunday. */
  days: PlanDay[];
  /** Sessions that didn't fit under the day limit or the heavy-day rule, so the player can see what's missing. */
  unplaced: PlanItem[];
}

/**
 * The skills to plan for: unlocked but not passed yet, and with a routine, in tree order.
 * `added` are skills the player put in the plan themselves ("Add to my plan"): kept if they have a
 * routine and aren't passed, even if they aren't unlocked yet.
 */
export function skillsToPlan(tree: Tree, done: Set<string>, added: string[] = []): Skill[] {
  const extra = new Set(added);
  return tree.skills.filter((s) => s.routine && !done.has(s.id) && (skillState(s, done) === "available" || extra.has(s.id)));
}

/** A day limit the app can use: a whole number from MIN_DAY_MINUTES to MAX_DAY_MINUTES, or the default. */
export function cleanDayMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DAY_MINUTES;
  return Math.min(MAX_DAY_MINUTES, Math.max(MIN_DAY_MINUTES, Math.round(n)));
}

function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/**
 * Builds the week's plan.
 *
 * Args:
 *   skills: What to plan, usually skillsToPlan(...). Earlier skills get first pick of days.
 *   levelId: The player's level, for each routine's minutes (null uses the first value).
 *   today: Any day in the week to plan; the plan runs Monday to Sunday of that week.
 *   dayMinutes: The most minutes of training on one day.
 *
 * Each skill gets up to `sessionsPerWeek` sessions, on different days, spread as far apart as the
 * week allows. A session goes on the lightest day that has room; a heavy session also needs both
 * neighbouring days to have no heavy session (two heavy sessions may share one day). Sessions that can't go anywhere are listed in
 * `unplaced` rather than breaking a rule.
 */
export function buildWeekPlan(skills: Skill[], levelId: string | null, today: DayKey, dayMinutes = DEFAULT_DAY_MINUTES): WeekPlan {
  const limit = cleanDayMinutes(dayMinutes);
  const monday = weekOf(today);
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(monday, i), items: [], minutes: 0 }));
  const unplaced: PlanItem[] = [];
  const hasHeavy = (i: number) => i >= 0 && i < 7 && days[i].items.some((it) => it.heavy);

  // Skills that need more sessions, or longer ones, are placed first, while the week is emptiest.
  const order = new Map(skills.map((s, i) => [s.id, i]));
  const queue = skills
    .filter((s) => s.routine)
    .map((s) => ({ skill: s, minutes: forLevel(s.routine!.minutes, levelId) ?? 0, sessions: Math.min(7, Math.max(1, s.routine!.sessionsPerWeek)) }))
    .sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes || order.get(a.skill.id)! - order.get(b.skill.id)!);

  for (const { skill, minutes, sessions } of queue) {
    const heavy = skill.routine!.heavy === true;
    const placedOn: number[] = [];
    for (let n = 0; n < sessions; n++) {
      const item: PlanItem = { skillId: skill.id, minutes, heavy };
      let best = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < 7; i++) {
        if (placedOn.includes(i)) continue;
        if (days[i].minutes + minutes > limit) continue;
        // Heavy sessions can share a day (time allowing), but never sit on back-to-back days.
        if (heavy && (hasHeavy(i - 1) || hasHeavy(i + 1))) continue;
        // Far from this skill's other sessions first, then the lightest day, then the earliest.
        const gap = placedOn.length ? Math.min(...placedOn.map((p) => Math.abs(p - i))) : 7;
        const score = gap * 1000 - days[i].minutes * 10 - i;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best < 0) {
        unplaced.push(item);
        continue;
      }
      days[best].items.push(item);
      days[best].minutes += minutes;
      placedOn.push(best);
    }
  }
  // Each day lists its skills in tree order, so the plan reads the same way every time.
  for (const d of days) d.items.sort((a, b) => order.get(a.skillId)! - order.get(b.skillId)!);
  return { days, unplaced };
}

/**
 * The plan's days the player trained on (from "I trained today", or finishing a planned session,
 * which ticks the same check-in). For the week view's done marks.
 */
export function trainedPlanDays(plan: WeekPlan, practiceDays: DayKey[]): DayKey[] {
  const trained = new Set(practiceDays);
  return plan.days.filter((d) => d.items.length > 0 && trained.has(d.date)).map((d) => d.date);
}

const dayMinutesKey = "skill-tree:plan-day-minutes";

/** The player's daily time limit, saved in this browser for every tree. */
export function loadDayMinutes(): number {
  try {
    const raw = localStorage.getItem(dayMinutesKey);
    return raw === null ? DEFAULT_DAY_MINUTES : cleanDayMinutes(Number(raw));
  } catch {
    return DEFAULT_DAY_MINUTES;
  }
}

export function saveDayMinutes(minutes: number): void {
  try {
    localStorage.setItem(dayMinutesKey, String(cleanDayMinutes(minutes)));
  } catch {
    // Storage can be blocked. The limit then only lasts for this visit.
  }
}
