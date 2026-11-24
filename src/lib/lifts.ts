import type { Tree } from "../types";

// The weights a player lifted, for skills with `logWeight` (#18).
//
// Each time a player passes a lift (or trains it again) they enter the weight they used.
// The app keeps every entry, so it can show their personal best and how it went up over time.
// Weights are stored in kilograms. Entries live in the browser for now; saving them to the
// account is a follow-up (a `lift_log` column next to the rest of the progress).

/** One time a lift was done. */
export interface LiftEntry {
  skillId: string;
  /** The day, as YYYY-MM-DD in the player's own time zone. */
  date: string;
  /** Weight used, in kilograms. 0 is allowed for a lift done with no added weight. */
  kg: number;
}

/** Heaviest weight we accept, in kilograms. Anything above is a typo (the world deadlift record is about 500). */
export const MAX_KG = 500;
/** Most entries kept per tree, so the saved log can't grow forever. Oldest go first. */
export const MAX_ENTRIES = 3000;

function isRealDay(d: unknown): d is string {
  if (typeof d !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, day));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === day;
}

/**
 * Turns what the player typed into kilograms, rounded to the nearest 0.25.
 *
 * Args:
 *   input: The weight as typed, e.g. "62.5", "62,5" or " 60 ".
 *
 * Returns:
 *   The weight, or null if it isn't a number between 0 and MAX_KG.
 */
export function parseKg(input: string): number | null {
  const text = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const kg = Math.round(Number(text) * 4) / 4;
  return kg >= 0 && kg <= MAX_KG ? kg : null;
}

/** Drops entries for skills the tree no longer has or that aren't lifts, and anything broken. Keeps date order. */
export function cleanLiftLog(tree: Tree, raw: unknown): LiftEntry[] {
  if (!Array.isArray(raw)) return [];
  const lifts = new Set(tree.skills.filter((s) => s.logWeight).map((s) => s.id));
  const ok = raw.filter(
    (e): e is LiftEntry =>
      typeof e === "object" &&
      e !== null &&
      lifts.has(e.skillId) &&
      isRealDay(e.date) &&
      typeof e.kg === "number" &&
      Number.isFinite(e.kg) &&
      e.kg >= 0 &&
      e.kg <= MAX_KG,
  );
  // A stable sort keeps entries from the same day in the order they were added.
  return ok.map((e) => ({ skillId: e.skillId, date: e.date, kg: e.kg })).sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_ENTRIES);
}

/** The log with one more entry, in date order. Returns the log unchanged if the entry isn't valid for this tree. */
export function addLiftEntry(tree: Tree, log: LiftEntry[], entry: LiftEntry): LiftEntry[] {
  return cleanLiftLog(tree, [...log, entry]);
}

/**
 * Removes one entry (for an "undo" right after a typo). Matches on lift, day and weight, not on
 * the object itself, because the log stores its own copies. If the same entry was logged twice,
 * the last one goes.
 */
export function removeLiftEntry(log: LiftEntry[], entry: LiftEntry): LiftEntry[] {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e.skillId === entry.skillId && e.date === entry.date && e.kg === entry.kg) {
      return [...log.slice(0, i), ...log.slice(i + 1)];
    }
  }
  return log;
}

/** Every entry for one lift, oldest first. */
export function liftHistory(log: LiftEntry[], skillId: string): LiftEntry[] {
  return log.filter((e) => e.skillId === skillId);
}

/** The heaviest entry for a lift, the earliest one if it was matched later. Null if it was never logged. */
export function personalBest(log: LiftEntry[], skillId: string): LiftEntry | null {
  let best: LiftEntry | null = null;
  for (const e of liftHistory(log, skillId)) if (!best || e.kg > best.kg) best = e;
  return best;
}

/**
 * The entries where the player beat their previous best, oldest first. Plotting these
 * shows the personal best going up over time.
 */
export function bestProgression(log: LiftEntry[], skillId: string): LiftEntry[] {
  const out: LiftEntry[] = [];
  for (const e of liftHistory(log, skillId)) if (out.length === 0 || e.kg > out[out.length - 1].kg) out.push(e);
  return out;
}

/** True if this entry would be a new personal best, for a "New best!" message when it's saved. */
export function isNewBest(log: LiftEntry[], entry: LiftEntry): boolean {
  const best = personalBest(log, entry.skillId);
  return best === null || entry.kg > best.kg;
}

/** "62.5 kg", without trailing zeros. */
export function formatKg(kg: number): string {
  return `${Number(kg.toFixed(2))} kg`;
}

const logKey = (treeId: string) => `skill-tree:${treeId}:lift-log`;

export function loadLiftLog(tree: Tree): LiftEntry[] {
  try {
    return cleanLiftLog(tree, JSON.parse(localStorage.getItem(logKey(tree.id)) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveLiftLog(treeId: string, log: LiftEntry[]): void {
  try {
    localStorage.setItem(logKey(treeId), JSON.stringify(log));
  } catch {
    // Storage can be blocked. The log then only lasts for this visit.
  }
}
