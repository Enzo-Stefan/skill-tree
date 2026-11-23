import type { PlayerLevel, Tree } from "../types";

/** A week counts toward the streak when the player trained on at least this many different days. */
export const PRACTICE_DAYS_PER_WEEK = 3;
/** Training weeks needed before the app asks "Do you think you've improved?". */
export const STREAK_WEEKS = 4;

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

/** Days the player trained in the week containing `today`. */
export function daysThisWeek(days: DayKey[], today: DayKey): number {
  const week = weekOf(today);
  return new Set(days.filter((d) => weekOf(d) === week)).size;
}

/**
 * Weeks with enough training days since the player last moved level. A missed week
 * pauses the streak: the count stays where it was and carries on when training resumes.
 * The current week counts once it has enough days.
 */
export function streakWeeks(days: DayKey[], since: WeekKey | null = null): number {
  const perWeek = new Map<WeekKey, Set<DayKey>>();
  for (const d of days) {
    const week = weekOf(d);
    perWeek.set(week, (perWeek.get(week) ?? new Set()).add(d));
  }
  let streak = 0;
  for (const [week, trained] of perWeek) {
    if (trained.size >= PRACTICE_DAYS_PER_WEEK && (since === null || week > since)) streak++;
  }
  return streak;
}

/** The player level to ask about moving up to, or null. Asks at most once a week and never past the top. */
export function levelUpDue(
  tree: Tree,
  levelId: string | null,
  days: DayKey[],
  today: DayKey,
  state: StreakState,
): PlayerLevel | null {
  const levels = tree.playerLevels ?? [];
  const index = levels.findIndex((l) => l.id === levelId);
  if (index < 0 || index === levels.length - 1) return null;
  if (state.askedWeek === weekOf(today)) return null;
  return streakWeeks(days, state.since) >= STREAK_WEEKS ? levels[index + 1] : null;
}

/**
 * Whether the Level picker may switch to `targetId`. The first pick is free, after that the picker
 * only goes down or stays put. The only way up is passing the test.
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

export function loadStreakState(treeId: string): StreakState {
  try {
    const raw = JSON.parse(localStorage.getItem(stateKey(treeId)) ?? "{}");
    return {
      since: typeof raw?.since === "string" ? raw.since : null,
      askedWeek: typeof raw?.askedWeek === "string" ? raw.askedWeek : null,
    };
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
