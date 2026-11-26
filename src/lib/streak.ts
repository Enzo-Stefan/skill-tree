import type { Tree } from "../types";
import { nextRung, type Rung } from "./progress";

/** A week counts toward the streak when the player trained on at least this many different days. */
export const PRACTICE_DAYS_PER_WEEK = 3;
/** Training weeks needed before the app asks "Do you think you've improved?". */
export const STREAK_WEEKS = 4;
/**
 * Only training weeks inside this many recent weeks (the current one included) count toward the
 * streak, so 4 good weeks spread across a year don't add up to a level-up question.
 */
export const RECENT_WEEKS = 8;

/** Dates are local calendar days written as `YYYY-MM-DD`, weeks are identified by their Monday. */
export type DayKey = string;
export type WeekKey = string;

export interface StreakState {
  /** Only weeks after this one count toward the streak. Set when the player moves up. */
  since: WeekKey | null;
  /** The week we last asked "Do you think you've improved?", so we ask at most once a week. */
  askedWeek: WeekKey | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parse(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The Monday of the week containing `day`. */
export function weekOf(day: DayKey): WeekKey {
  const date = parse(day);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKey(date);
}

/**
 * The training days with `day` added, for passing a test (#46): passing counts as training.
 * Only ever adds. Returns the same list if the day is already there, so nothing is saved twice.
 */
export function addTrainingDay(days: DayKey[], day: DayKey): DayKey[] {
  return days.includes(day) ? days : [...days, day].sort();
}

/** Days the player trained in the week containing `today`. */
export function daysThisWeek(days: DayKey[], today: DayKey): number {
  const week = weekOf(today);
  return new Set(days.filter((d) => weekOf(d) === week)).size;
}

/** The Monday of the oldest week that still counts toward the streak, RECENT_WEEKS back from `today`. */
export function oldestCountingWeek(today: DayKey): WeekKey {
  const date = parse(weekOf(today));
  date.setDate(date.getDate() - 7 * (RECENT_WEEKS - 1));
  return dayKey(date);
}

/**
 * Weeks with enough training days since the player last moved level, within the last
 * RECENT_WEEKS weeks. A missed week pauses the streak: the count stays where it was and carries
 * on when training resumes, but weeks older than RECENT_WEEKS drop out of it.
 * The current week counts once it has enough days.
 */
export function streakWeeks(days: DayKey[], since: WeekKey | null, today: DayKey): number {
  const oldest = oldestCountingWeek(today);
  const perWeek = new Map<WeekKey, Set<DayKey>>();
  for (const d of days) {
    const week = weekOf(d);
    perWeek.set(week, (perWeek.get(week) ?? new Set()).add(d));
  }
  let streak = 0;
  for (const [week, trained] of perWeek) {
    if (trained.size >= PRACTICE_DAYS_PER_WEEK && week >= oldest && (since === null || week > since)) streak++;
  }
  return streak;
}

/** Whether the week containing `today` can count toward the streak: not the week the player changed step. */
export function weekCanCount(since: WeekKey | null, today: DayKey): boolean {
  return since === null || weekOf(today) > since;
}

/**
 * How many more training days the week needs, when the day is a Friday or Saturday and the goal is
 * still reachable this week, or null. Days still open are today (unless it's already a training day)
 * and the days up to Sunday.
 */
export function weekNudge(days: DayKey[], since: WeekKey | null, today: DayKey): number | null {
  const weekday = parse(today).getDay();
  if (weekday !== 5 && weekday !== 6) return null;
  if (!weekCanCount(since, today)) return null;
  const left = PRACTICE_DAYS_PER_WEEK - daysThisWeek(days, today);
  if (left <= 0) return null;
  const daysToSunday = 7 - ((weekday + 6) % 7);
  const open = daysToSunday - (days.includes(today) ? 1 : 0);
  return left <= open ? left : null;
}

/**
 * The step to ask about moving up to (the next step, or step 1 of the next level), or null.
 * Asks at most once a week and never past the top step.
 */
export function levelUpDue(
  tree: Tree,
  rung: Rung | null,
  days: DayKey[],
  today: DayKey,
  state: StreakState,
): Rung | null {
  const next = nextRung(tree, rung);
  if (!next) return null;
  if (state.askedWeek === weekOf(today)) return null;
  return streakWeeks(days, state.since, today) >= STREAK_WEEKS ? next : null;
}

/**
 * Whether the Level picker may switch to `targetId`. On the first pick every level is open (one
 * above the first asks for its test first, see needsPlacementTest). After that the picker only
 * goes down or stays put. The only way up is passing the test.
 */
export function canPickLevel(tree: Tree, currentId: string | null, targetId: string): boolean {
  const levels = tree.playerLevels ?? [];
  const current = levels.findIndex((l) => l.id === currentId);
  if (current < 0) return true;
  return levels.findIndex((l) => l.id === targetId) <= current;
}

const daysKey = (treeId: string) => `skill-tree:${treeId}:practice-days`;
const stateKey = (treeId: string) => `skill-tree:${treeId}:streak-state`;

export function loadPracticeDays(treeId: string): DayKey[] {
  try {
    const raw = JSON.parse(localStorage.getItem(daysKey(treeId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((d): d is DayKey => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  } catch {
    return [];
  }
}

export function savePracticeDays(treeId: string, days: DayKey[]): void {
  try {
    localStorage.setItem(daysKey(treeId), JSON.stringify([...new Set(days)].sort()));
  } catch {
    // Storage can be blocked. Check-ins then only last for this visit.
  }
}

/** A real calendar day written YYYY-MM-DD (weeks are identified by their Monday), or null. Anything else in storage is ignored. */
function weekOrNull(value: unknown): WeekKey | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? value : null;
}

export function loadStreakState(treeId: string): StreakState {
  try {
    const raw = JSON.parse(localStorage.getItem(stateKey(treeId)) ?? "{}");
    return { since: weekOrNull(raw?.since), askedWeek: weekOrNull(raw?.askedWeek) };
  } catch {
    return { since: null, askedWeek: null };
  }
}

export function saveStreakState(treeId: string, state: StreakState): void {
  try {
    localStorage.setItem(stateKey(treeId), JSON.stringify(state));
  } catch {
    // Storage can be blocked. The state then only lasts for this visit.
  }
}

/**
 * Whether a first pick needs the placement test: the player has no level yet, picks one above the
 * easiest, and the tree has targets to test. The easiest level is always a free pick.
 */
export function needsPlacementTest(tree: Tree, currentId: string | null, targetId: string): boolean {
  const levels = tree.playerLevels ?? [];
  if (levels.some((l) => l.id === currentId)) return false;
  return levels.findIndex((l) => l.id === targetId) > 0 && tree.skills.some((s) => s.targets);
}
