import type { Skill, Tree } from "../types";
import { targetValue, type Rung } from "./progress";

// The number a player got when they did a skill's test (idea 6 in #17): "5.61" seconds on the
// sprint, for example. Kept per tree in the browser, like the lift log, so the app can show
// "Best: 5.61 s" and the best getting better over time.
//
// A result is in the same unit as the skill's targets, so it can be compared with them. Only
// skills with number targets can have results for now. Other tests ("8 of 10", "20 juggles")
// need the structured test description from idea 4 first. Saving results to the account is a
// follow-up, in the same migration as the lift log, so the table changes once.

/** One time the player did a skill's test and wrote down what they got. */
export interface TestResult {
  skillId: string;
  /** The day, as YYYY-MM-DD in the player's own time zone. */
  date: string;
  /** What they got, in the unit of the skill's targets (seconds, reps, ...). */
  value: number;
}

/** Whether a smaller or a bigger number is the better result. */
export type Better = "lower" | "higher";

/** Biggest number we accept. Anything above is a typo. */
export const MAX_VALUE = 100_000;
/** Most results kept per tree, so the saved list can't grow forever. Oldest go first. */
export const MAX_RESULTS = 3000;

/**
 * Whether lower or higher is better for this skill, worked out from its targets: if the target
 * goes down from one level to the next (faster times), lower is better. Null if the skill has no
 * number targets, so it can't store results yet.
 */
export function resultDirection(tree: Tree, skill: Skill): Better | null {
  const levels = tree.playerLevels ?? [];
  const values = skill.targets?.values;
  if (!values || levels.length < 2) return null;
  const first = values[levels[0].id];
  const second = values[levels[1].id];
  if (!Number.isFinite(first) || !Number.isFinite(second) || first === second) return null;
  return second < first ? "lower" : "higher";
}

/**
 * Turns what the player typed into a number, rounded to hundredths.
 *
 * Args:
 *   input: The result as typed, e.g. "5.61", "5,61" or " 12 ".
 *
 * Returns:
 *   The number, or null if it isn't a number above 0 and up to MAX_VALUE.
 */
export function parseResult(input: string): number | null {
  const text = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Math.round(Number(text) * 100) / 100;
  return value > 0 && value <= MAX_VALUE ? value : null;
}

function isRealDay(d: unknown): d is string {
  if (typeof d !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, day));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === day;
}

/** Drops results for skills the tree no longer has or that can't store results, and anything broken. Keeps date order. */
export function cleanResults(tree: Tree, raw: unknown): TestResult[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(tree.skills.filter((s) => resultDirection(tree, s) !== null).map((s) => s.id));
  const ok = raw.filter(
    (r): r is TestResult =>
      typeof r === "object" &&
      r !== null &&
      allowed.has(r.skillId) &&
      isRealDay(r.date) &&
      typeof r.value === "number" &&
      Number.isFinite(r.value) &&
      r.value > 0 &&
      r.value <= MAX_VALUE,
  );
  // A stable sort keeps results from the same day in the order they were added.
  return ok
    .map((r) => ({ skillId: r.skillId, date: r.date, value: r.value }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_RESULTS);
}

/** The list with one more result, in date order. Returns the list unchanged if the result isn't valid for this tree. */
export function addResult(tree: Tree, results: TestResult[], result: TestResult): TestResult[] {
  return cleanResults(tree, [...results, result]);
}

/** Removes one result (for an "undo" after a typo). If the same result was added twice, the last one goes. */
export function removeResult(results: TestResult[], result: TestResult): TestResult[] {
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.skillId === result.skillId && r.date === result.date && r.value === result.value) {
      return [...results.slice(0, i), ...results.slice(i + 1)];
    }
  }
  return results;
}

/** Every result for one skill, oldest first. */
export function resultHistory(results: TestResult[], skillId: string): TestResult[] {
  return results.filter((r) => r.skillId === skillId);
}

const beats = (better: Better, a: number, b: number) => (better === "lower" ? a < b : a > b);

/** The best result for a skill, the earliest one if it was matched later. Null if there's none. */
export function bestResult(tree: Tree, results: TestResult[], skillId: string): TestResult | null {
  const skill = tree.skills.find((s) => s.id === skillId);
  const better = skill ? resultDirection(tree, skill) : null;
  if (!better) return null;
  let best: TestResult | null = null;
  for (const r of resultHistory(results, skillId)) if (!best || beats(better, r.value, best.value)) best = r;
  return best;
}

/** The results where the player beat their previous best, oldest first, for a chart of the best getting better. */
export function bestProgression(tree: Tree, results: TestResult[], skillId: string): TestResult[] {
  const skill = tree.skills.find((s) => s.id === skillId);
  const better = skill ? resultDirection(tree, skill) : null;
  if (!better) return [];
  const out: TestResult[] = [];
  for (const r of resultHistory(results, skillId)) if (out.length === 0 || beats(better, r.value, out[out.length - 1].value)) out.push(r);
  return out;
}

/** True if this result would be a new best, for a "New best!" message when it's saved. */
export function isNewBestResult(tree: Tree, results: TestResult[], result: TestResult): boolean {
  const best = bestResult(tree, results, result.skillId);
  const skill = tree.skills.find((s) => s.id === result.skillId);
  const better = skill ? resultDirection(tree, skill) : null;
  if (!better) return false;
  return best === null || beats(better, result.value, best.value);
}

/**
 * Whether a result reaches the skill's target at this level and step, so "I passed" can light up.
 * Times must be under the target ("Under 5.8 seconds"), counts must reach it ("at least 12").
 * Null if there's no target to compare with.
 */
export function meetsTarget(tree: Tree, skill: Skill, rung: Rung | null, value: number): boolean | null {
  const target = targetValue(tree, skill, rung);
  const better = resultDirection(tree, skill);
  if (target === null || !better) return null;
  return better === "lower" ? value < target : value >= target;
}

const resultsKey = (treeId: string) => `skill-tree:${treeId}:results`;

export function loadResults(tree: Tree): TestResult[] {
  try {
    return cleanResults(tree, JSON.parse(localStorage.getItem(resultsKey(tree.id)) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveResults(treeId: string, results: TestResult[]): void {
  try {
    localStorage.setItem(resultsKey(treeId), JSON.stringify(results));
  } catch {
    // Storage can be blocked. The results then only last for this visit.
  }
}
