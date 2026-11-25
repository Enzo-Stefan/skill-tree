import type { Tree } from "../types";


// What a player worked on each day (idea 5 in #17, "today's session"). "I trained today" records the
// day; this records which skills were trained on it, so the app can show a training history and how
// often each skill was practised. Kept per tree in the browser and, when signed in, in the account
// (the `sessions` column, supabase/migrations/004_sessions.sql).
//
// Stored as (day, skill) pairs. A skill is either trained on a day or not, so pairs are a set: the
// account sync merges and replays them like finished skills.

/** One skill trained on one day. */
export interface SessionEntry {
  /** The day, as YYYY-MM-DD in the player's own time zone. */
  date: string;
  skillId: string;
}

/** Most pairs kept per tree, so the saved list can't grow forever. Oldest go first. */
export const MAX_SESSION_ENTRIES = 5000;

const pairKey = (e: SessionEntry) => `${e.date}|${e.skillId}`;

function isRealDay(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, day));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === day;
}

/**
 * Drops anything broken: unknown skills, days that don't exist, and duplicates. Sorted by day, then
 * by the skill's place in the tree, so the same pairs always come out in the same order.
 */
export function cleanSessions(tree: Tree, raw: unknown): SessionEntry[] {
  if (!Array.isArray(raw)) return [];
  const order = new Map(tree.skills.map((s, i) => [s.id, i]));
  const seen = new Set<string>();
  const out: SessionEntry[] = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const { date, skillId } = e as Partial<SessionEntry>;
    if (typeof date !== "string" || !isRealDay(date) || typeof skillId !== "string" || !order.has(skillId)) continue;
    const key = pairKey({ date, skillId });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, skillId });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || order.get(a.skillId)! - order.get(b.skillId)!);
  return out.slice(-MAX_SESSION_ENTRIES);
}

/** The skills trained on a day, in tree order. */
export function skillsOn(sessions: SessionEntry[], date: string): string[] {
  return sessions.filter((e) => e.date === date).map((e) => e.skillId);
}

/**
 * The list with a day's skills set to exactly `skillIds` (what the player ticked in "What did you
 * work on?"). An empty list clears the day. Other days are unchanged.
 */
export function setSkillsOn(tree: Tree, sessions: SessionEntry[], date: string, skillIds: string[]): SessionEntry[] {
  const others = sessions.filter((e) => e.date !== date);
  return cleanSessions(tree, [...others, ...skillIds.map((skillId) => ({ date, skillId }))]);
}

/** How many different days a skill was trained on, and the last one (or null). */
export function skillHistory(sessions: SessionEntry[], skillId: string): { days: number; last: string | null } {
  const dates = sessions.filter((e) => e.skillId === skillId).map((e) => e.date);
  return { days: dates.length, last: dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null };
}

/** Both lists together, for the first sign-in on a device: every pair from either. */
export function mergeSessions(tree: Tree, a: SessionEntry[], b: SessionEntry[]): SessionEntry[] {
  return cleanSessions(tree, [...a, ...b]);
}

/**
 * The changes made here since `from` applied on top of `onto`: a skill ticked here for a day is
 * added, one un-ticked here is removed, and pairs from other devices stay. Pairs are a set, so
 * replaying the same change twice gives the same result.
 */
export function replaySessions(tree: Tree, onto: SessionEntry[], from: SessionEntry[], to: SessionEntry[]): SessionEntry[] {
  const before = new Set(from.map(pairKey));
  const after = new Set(to.map(pairKey));
  const out = new Map(onto.map((e) => [pairKey(e), e]));
  for (const e of to) if (!before.has(pairKey(e))) out.set(pairKey(e), e);
  for (const e of from) if (!after.has(pairKey(e))) out.delete(pairKey(e));
  return cleanSessions(tree, [...out.values()]);
}

/** Pairs in a fixed order, to compare two lists however they were sorted. */
export function sessionKeys(sessions: SessionEntry[]): string[] {
  return sessions.map(pairKey).sort();
}

const sessionsKey = (treeId: string) => `skill-tree:${treeId}:sessions`;

export function loadSessions(tree: Tree): SessionEntry[] {
  try {
    return cleanSessions(tree, JSON.parse(localStorage.getItem(sessionsKey(tree.id)) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveSessions(treeId: string, sessions: SessionEntry[]): void {
  try {
    localStorage.setItem(sessionsKey(treeId), JSON.stringify(sessions));
  } catch {
    // Storage can be blocked. The sessions then only last for this visit.
  }
}
