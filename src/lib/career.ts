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
  /** True when some of this week's XP has no day of its own and is placed by the time its ledger event last changed. */
  undated: boolean;
}

/** The first-pass day of each skill, from its passday marker. Undoing a pass switches the marker off but never removes it. */
function firstPassDays(events: XpEvent[]): Map<string, DayKey> {
  const out = new Map<string, DayKey>();
  for (const e of events) {
    const m = /^passday:(.+):(\d{4}-\d{2}-\d{2})$/.exec(e.key);
    if (!m) continue;
    const day = m[2] as DayKey;
    const known = out.get(m[1]!);
    if (!known || day < known) out.set(m[1]!, day);
  }
  return out;
}

/** The day an event is for when its key carries one: sessions, missions and challenges (a weekly challenge's day is its Monday). */
function dayFromKey(key: string): DayKey | null {
  const m = /^(?:session:(\d{4}-\d{2}-\d{2})|mission:(\d{4}-\d{2}-\d{2}):.+|challenge:.+:(\d{4}-\d{2}-\d{2}))$/.exec(key);
  const day = m?.[1] ?? m?.[2] ?? m?.[3];
  return day ? (day as DayKey) : null;
}

/** The day an XP event belongs to, or null when its key has none (a skill pass with no marker, mastery, achievements, streaks, season challenges). */
function ownDay(e: XpEvent, passDays: Map<string, DayKey>): DayKey | null {
  const fromKey = dayFromKey(e.key);
  if (fromKey) return fromKey;
  const pass = /^skill:(.+):pass$/.exec(e.key);
  return pass ? (passDays.get(pass[1]!) ?? null) : null;
}

/**
 * XP per week for the last `weeks` weeks ending with the week of `today`, oldest first, empty weeks as 0. Each event
 * counts in the week of its own day (the local day in its key, or the day of a skill's first pass). Only an event with
 * no day of its own falls back to the local day its ledger entry last changed.
 */
export function xpPerWeek(events: XpEvent[], today: DayKey, weeks: number): WeekXp[] {
  const passDays = firstPassDays(events);
  const byWeek = new Map<WeekKey, { xp: number; undated: boolean }>();
  for (const e of events) {
    if (!e.active || e.xp === 0) continue;
    const own = ownDay(e, passDays);
    const day = own ?? localDay(e.at);
    if (!day) continue;
    const week = weekOf(day);
    const cur = byWeek.get(week) ?? { xp: 0, undated: false };
    byWeek.set(week, { xp: cur.xp + e.xp, undated: cur.undated || own === null });
  }
  const last = weekOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(last, -WEEK_DAYS * (weeks - 1 - i));
    const cur = byWeek.get(week);
    return { week, xp: cur?.xp ?? 0, undated: cur?.undated ?? false };
  });
}

export interface RankReached {
  name: string;
  /** Day the rank was reached, or null when the ledger can't tell (progress from before XP). */
  day: DayKey | null;
}

/**
 * The ranks the player has reached, lowest first. A rank is reached with its `at` skills. Only passes made since the
 * passday markers were added have a known day (the marker is written on a skill's first pass), and every older pass
 * happened before any marked one, so the Nth pass's day is the (N - undated)th marked day. A rank reached by older
 * passes, and the starting rank (0 passes), has no day (null, shown as "Before tracking").
 */
export function ranksReached(tree: Tree, done: Set<string>, events: XpEvent[]): RankReached[] {
  const passDays = firstPassDays(events);
  const days = [...done].flatMap((id) => passDays.get(id) ?? []).sort();
  const undated = done.size - days.length;
  return tree.levels
    .filter((l) => done.size >= l.at)
    .map((l) => {
      const index = l.at - undated;
      return { name: l.name, day: l.at > 0 && index >= 1 ? (days[index - 1] ?? null) : null };
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

