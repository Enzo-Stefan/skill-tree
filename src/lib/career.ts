import type { Tree } from "../types";
import type { RatingSnapshot } from "./ratingHistory";
import type { SessionEntry } from "./sessions";
import type { TestResult } from "./results";
import { forLevel } from "./progress";
import { dayKey, PRACTICE_DAYS_PER_WEEK, weekOf, type DayKey, type WeekKey } from "./streak";
import type { XpEvent } from "./xp";

// The career page (#124): lifetime numbers worked out from what the app already saves: the training days,
// the saved sessions and results, the XP ledger and the weekly rating snapshots. Nothing is stored here.

const WEEK_DAYS = 7;

const localDay = (iso: string): DayKey | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
};

const addDays = (week: WeekKey, n: number): WeekKey => {
  const [y, m, d] = week.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

export interface Totals {
  /** Distinct days with training: practice days plus days with a saved session. */
  sessions: number;
  /** Estimated minutes: each saved session counts its skill's routine length at the player's level. */
  minutes: number;
  /** Most weeks in a row with enough training days. */
  longestStreak: number;
  /** Saved test results. */
  results: number;
}

/** The longest run of consecutive weeks that each have PRACTICE_DAYS_PER_WEEK or more training days. */
export function longestStreak(days: DayKey[]): number {
  const perWeek = new Map<WeekKey, Set<DayKey>>();
  for (const d of days) {
    const w = weekOf(d);
    perWeek.set(w, (perWeek.get(w) ?? new Set()).add(d));
  }
  const good = [...perWeek].filter(([, set]) => set.size >= PRACTICE_DAYS_PER_WEEK).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  let prev: WeekKey | null = null;
  for (const w of good) {
    run = prev !== null && addDays(prev, WEEK_DAYS) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

export function careerTotals(tree: Tree, practiceDays: DayKey[], sessions: SessionEntry[], results: TestResult[], levelId: string | null): Totals {
  const dates = new Set<DayKey>([...practiceDays, ...sessions.map((s) => s.date)]);
  const minutes = sessions.reduce((sum, s) => {
    const routine = tree.skills.find((k) => k.id === s.skillId)?.routine;
    return sum + (routine ? forLevel(routine.minutes, levelId) ?? 0 : 0);
  }, 0);
  return { sessions: dates.size, minutes, longestStreak: longestStreak(practiceDays), results: results.length };
}

/** Hours and minutes for a number of minutes: 135 gives { hours: 2, minutes: 15 }. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const m = Math.max(0, Math.round(total));
  return { hours: Math.floor(m / 60), minutes: m % 60 };
}

const active = (events: XpEvent[], prefix: string) => events.filter((e) => e.active && e.key.startsWith(prefix));

/** How many missions the ledger holds as earned. */
export const missionsCompleted = (events: XpEvent[]): number => active(events, "mission:").length;

export interface WeekXp {
  week: WeekKey;
  xp: number;
}

/** XP per week for the last `weeks` weeks ending with the week of `today`, oldest first, empty weeks as 0. */
export function xpPerWeek(events: XpEvent[], today: DayKey, weeks: number): WeekXp[] {
  const byWeek = new Map<WeekKey, number>();
  for (const e of events) {
    if (!e.active) continue;
    const day = localDay(e.at);
    if (day) byWeek.set(weekOf(day), (byWeek.get(weekOf(day)) ?? 0) + e.xp);
  }
  const last = weekOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(last, -WEEK_DAYS * (weeks - 1 - i));
    return { week, xp: byWeek.get(week) ?? 0 };
  });
}

export interface RankReached {
  name: string;
  /** Day the rank was reached, or null when the ledger can't tell (progress from before XP). */
  day: DayKey | null;
}

/**
 * The ranks the player has reached, lowest first. A rank is reached with its `at` skills; the day is when the
 * ledger recorded that many passes (the Nth earliest active pass event).
 */
export function ranksReached(tree: Tree, doneCount: number, events: XpEvent[]): RankReached[] {
  const passDays = active(events, "skill:")
    .filter((e) => e.key.endsWith(":pass"))
    .map((e) => e.at)
    .sort();
  return tree.levels
    .filter((l) => doneCount >= l.at)
    .map((l) => {
      const at = passDays[Math.max(1, l.at) - 1];
      return { name: l.name, day: at ? localDay(at) : null };
    });
}

export interface BranchLine {
  branchId: string;
  /** Rating of the first and last snapshot. */
  first: number;
  last: number;
  /** SVG polyline points, or "" with fewer than two weeks. */
  points: string;
  /** Lowest and highest value the line is scaled to. */
  low: number;
  high: number;
}

export const LINE_W = 280;
export const LINE_H = 64;
const PAD = 6;
const MIN_SPAN = 10;

/** One line per branch from the weekly snapshots, each scaled to its own range (at least 10 points wide). */
export function branchLines(tree: Tree, history: RatingSnapshot[]): BranchLine[] {
  return tree.branches.flatMap((b) => {
    const values = history.map((s) => s.ratings[b.id]).filter((v): v is number => typeof v === "number");
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.min(99, Math.max(MIN_SPAN, max - min + 4));
    const low = Math.min(Math.max(0, (min + max) / 2 - span / 2), 99 - span);
    const high = low + span;
    const step = values.length > 1 ? LINE_W / (values.length - 1) : 0;
    const points =
      values.length < 2
        ? ""
        : values
            .map((v, i) => {
              const y = PAD + (LINE_H - 2 * PAD) * (1 - (v - low) / (high - low));
              return `${Math.round(i * step * 10) / 10},${Math.round(y * 10) / 10}`;
            })
            .join(" ");
    return [{ branchId: b.id, first: values[0], last: values[values.length - 1], points, low, high }];
  });
}

