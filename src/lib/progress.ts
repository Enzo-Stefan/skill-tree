import type { Level, Skill, SkillState, TestCheck, Tree } from "../types";

export function skillState(skill: Skill, done: Set<string>): SkillState {
  if (done.has(skill.id)) return "done";
  return skill.requires.every((r) => done.has(r)) ? "available" : "locked";
}

export function levelInfo(levels: Level[], count: number): { current: Level; next: Level | null } {
  let current = levels[0];
  let next: Level | null = levels[1] ?? null;
  levels.forEach((lvl, i) => {
    if (count >= lvl.at) {
      current = lvl;
      next = levels[i + 1] ?? null;
    }
  });
  return { current, next };
}

/** Skills that become available when `skillId` is completed. */
export function newlyUnlocked(tree: Tree, done: Set<string>, skillId: string): Skill[] {
  const after = new Set(done).add(skillId);
  return tree.skills.filter(
    (s) => skillState(s, done) === "locked" && skillState(s, after) === "available",
  );
}

/** Completed skills that depend on `skillId`. These must be undone first. */
export function completedDependents(tree: Tree, done: Set<string>, skillId: string): Skill[] {
  return tree.skills.filter((s) => s.requires.includes(skillId) && done.has(s.id));
}

/**
 * The skill to suggest training next (the "Next up" card), or null when everything is done.
 *
 * Picks from the skills that are unlocked but not finished. It prefers the branch where the
 * player has finished the smallest share of skills, so the tree grows evenly. Inside a branch it
 * takes the skill nearest the top. Ties go to the branch listed first in the tree. Skills outside
 * any branch (the start and the final skill) come first whenever they're unlocked, because they
 * are the only way forward at the start and the end.
 */
export function nextSkill(tree: Tree, done: Set<string>): Skill | null {
  const open = tree.skills.filter((s) => skillState(s, done) === "available");
  if (open.length === 0) return null;
  const shared = open.find((s) => s.branch === null);
  if (shared) return shared;
  const share = (branchId: string) => {
    const skills = tree.skills.filter((s) => s.branch === branchId);
    return skills.filter((s) => done.has(s.id)).length / skills.length;
  };
  const order = (branchId: string | null) => tree.branches.findIndex((b) => b.id === branchId);
  return [...open].sort(
    (a, b) => share(a.branch!) - share(b.branch!) || order(a.branch) - order(b.branch) || a.row - b.row || a.x - b.x,
  )[0];
}

const storageKey = (treeId: string) => `skill-tree:${treeId}`;

/**
 * The finished skills saved in this browser for a tree. Ids the tree no longer has (a renamed or
 * removed skill) are dropped, so they can't count toward the total or the rank ("33 of 32").
 */
export function loadProgress(tree: Tree): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(tree.id)) ?? "[]");
    const ids = new Set(tree.skills.map((s) => s.id));
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && ids.has(id)) : []);
  } catch {
    return new Set();
  }
}

export function saveProgress(treeId: string, done: Set<string>): void {
  try {
    localStorage.setItem(storageKey(treeId), JSON.stringify([...done]));
  } catch {
    // Storage can be blocked (private mode). The app still works for this visit.
  }
}

const playerLevelKey = (treeId: string) => `skill-tree:${treeId}:player-level`;

/** The player's chosen ability level for a tree, or null if they haven't picked one. */
export function loadPlayerLevel(tree: Tree): string | null {
  try {
    const id = localStorage.getItem(playerLevelKey(tree.id));
    return tree.playerLevels?.some((l) => l.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function savePlayerLevel(treeId: string, levelId: string): void {
  try {
    localStorage.setItem(playerLevelKey(treeId), levelId);
  } catch {
    // Storage can be blocked. The choice still works for this visit.
  }
}

const playerStepKey = (treeId: string) => `skill-tree:${treeId}:player-step`;

/** The player's step inside their level, 1 if they have none saved yet. */
export function loadPlayerStep(treeId: string): number {
  try {
    return cleanStep(Number(localStorage.getItem(playerStepKey(treeId))));
  } catch {
    return 1;
  }
}

export function savePlayerStep(treeId: string, step: number): void {
  try {
    localStorage.setItem(playerStepKey(treeId), String(cleanStep(step)));
  } catch {
    // Storage can be blocked. The step still works for this visit.
  }
}

/** Forgets the player's level and step for a tree, so the level picker asks again (used by Reset). */
export function clearPlayerLevel(treeId: string): void {
  try {
    localStorage.removeItem(playerLevelKey(treeId));
    localStorage.removeItem(playerStepKey(treeId));
  } catch {
    // Storage can be blocked. The app still forgets the level for this visit.
  }
}

/** Steps inside each player level: Beginner 1 to 4, Intermediate 1 to 4 and so on. */
export const STEPS_PER_LEVEL = 4;

/** Where a player trains: a player level and a step inside it, 1 to STEPS_PER_LEVEL. */
export interface Rung {
  levelId: string;
  step: number;
}

/** A whole step between 1 and STEPS_PER_LEVEL. Anything else becomes 1. */
export function cleanStep(step: unknown): number {
  return Number.isInteger(step) && (step as number) >= 1 && (step as number) <= STEPS_PER_LEVEL ? (step as number) : 1;
}

/** "Beginner 2", or null if the level isn't in the tree. */
export function rungName(tree: Tree, rung: Rung | null): string | null {
  const level = tree.playerLevels?.find((l) => l.id === rung?.levelId);
  return level && rung ? `${level.name} ${cleanStep(rung.step)}` : null;
}

/** The step after this one: the next step in the same level, or step 1 of the next level. Null at the very top. */
export function nextRung(tree: Tree, rung: Rung | null): Rung | null {
  const levels = tree.playerLevels ?? [];
  const index = levels.findIndex((l) => l.id === rung?.levelId);
  if (!rung || index < 0) return null;
  const step = cleanStep(rung.step);
  if (step < STEPS_PER_LEVEL) return { levelId: rung.levelId, step: step + 1 };
  return index + 1 < levels.length ? { levelId: levels[index + 1].id, step: 1 } : null;
}

/**
 * The target number for this skill at a level and step, or null if the skill has one test
 * for everyone. Step 1 is the level's own number, steps 2 to 4 sit evenly between it and the
 * next level's number. The top level keeps going at the same pace as the step below it.
 */
export function targetValue(tree: Tree, skill: Skill, rung: Rung | null): number | null {
  const levels = tree.playerLevels ?? [];
  const index = levels.findIndex((l) => l.id === rung?.levelId);
  const values = skill.targets?.values;
  if (!values || !rung || index < 0) return null;
  // Work in hundredths. An exact half rounds toward the harder target, so a step is never
  // easier than the exact in-between number: falling times round down (5.675 becomes 5.67),
  // rising targets like reps round up.
  const at = (i: number) => Math.round(values[levels[i].id] * 100);
  const from = at(index);
  const to = index + 1 < levels.length ? at(index + 1) : index > 0 ? from + (from - at(index - 1)) : from;
  const exact = from + ((to - from) * (cleanStep(rung.step) - 1)) / STEPS_PER_LEVEL;
  return (to < from ? Math.ceil(exact - 0.5) : Math.round(exact)) / 100;
}

/**
 * A number the way the reader writes it: "5.8" in English, "5,8" in Spanish. Up to 2 decimals,
 * no thousands separator (targets and weights are small, and "1.500" would read as 1.5 in English).
 */
export function formatNumber(n: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(n);
}

/** Every skill with its own target at this level and step: what a level test asks the player to do. */
export function testTargets(tree: Tree, rung: Rung | null, locale = "en"): { skillName: string; target: string }[] {
  return tree.skills.flatMap((s) => {
    const target = targetFor(tree, s, rung, locale);
    return target ? [{ skillName: s.name, target }] : [];
  });
}

/**
 * The stopwatch limit in seconds for a timed test: its own `under`, or the level target when the
 * limit depends on the player's level. Null if the test isn't timed or there's no level to go by.
 */
export function timeLimit(tree: Tree, skill: Skill, rung: Rung | null): number | null {
  if (skill.check?.kind !== "time") return null;
  return skill.check.under ?? targetValue(tree, skill, rung);
}

/** The target sentence for this skill at a level and step, e.g. "Under 5.67 seconds.", or null. The number is written for `locale`. */
export function targetFor(tree: Tree, skill: Skill, rung: Rung | null, locale = "en"): string | null {
  const value = targetValue(tree, skill, rung);
  return value === null || !skill.targets ? null : skill.targets.text.replace("{n}", formatNumber(value, locale));
}

/** The words of the "Copy my progress" text, so it can be in the app's language. */
export interface SummaryWords {
  headline: (title: string, done: number, total: number, rank: string) => string;
  training: (rung: string) => string;
}

const ENGLISH_SUMMARY: SummaryWords = {
  headline: (title, done, total, rank) => `My ${title}: ${done}/${total} skills, rank ${rank}.`,
  training: (rung) => ` Training at ${rung}.`,
};

export function progressSummary(tree: Tree, done: Set<string>, rung: Rung | null = null, words: SummaryWords = ENGLISH_SUMMARY): string {
  const { current } = levelInfo(tree.levels, done.size);
  const training = rungName(tree, rung);
  const lines = tree.branches.map((b) => {
    const skills = tree.skills.filter((s) => s.branch === b.id);
    const count = skills.filter((s) => done.has(s.id)).length;
    return `${b.name}: ${count}/${skills.length}`;
  });
  const levelText = training ? words.training(training) : "";
  return [`${words.headline(tree.title, done.size, tree.skills.length, current.name)}${levelText}`, ...lines].join("\n");
}

const MAX_NAME_LENGTH = 24;

/** Checks a tree for mistakes. Run it when you add or edit a tree. */
export function validateTree(tree: Tree): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const branchIds = new Set(tree.branches.map((b) => b.id));
  for (const s of tree.skills) {
    if (ids.has(s.id)) errors.push(`Duplicate skill id: ${s.id}`);
    ids.add(s.id);
    if (s.branch !== null && !branchIds.has(s.branch)) errors.push(`${s.id}: unknown branch ${s.branch}`);
  }
  for (const s of tree.skills) {
    for (const field of ["name", "drill", "test", "tip"] as const) {
      if (!s[field].trim()) errors.push(`${s.id}: ${field} is empty`);
    }
    if (s.name.length > MAX_NAME_LENGTH) {
      errors.push(`${s.id}: name "${s.name}" is longer than ${MAX_NAME_LENGTH} characters and won't fit under its tile`);
    }
    if (s.targets) {
      const { text, values } = s.targets;
      const slots = text.split("{n}").length - 1;
      if (slots === 0) errors.push(`${s.id}: target text has no {n} where the number goes`);
      if (slots > 1) errors.push(`${s.id}: target text has more than one {n}, only the first gets the number`);
      const levelIds = (tree.playerLevels ?? []).map((l) => l.id);
      if (levelIds.length === 0) errors.push(`${s.id}: has targets, but the tree has no playerLevels`);
      const missing = levelIds.filter((id) => !(id in values));
      const extra = Object.keys(values).filter((id) => !levelIds.includes(id));
      const bad = levelIds.filter((id) => id in values && !(Number.isFinite(values[id]) && values[id] > 0));
      if (missing.length) errors.push(`${s.id}: no target for level ${missing.join(", ")}`);
      if (extra.length) errors.push(`${s.id}: target for unknown level ${extra.join(", ")}`);
      if (bad.length) errors.push(`${s.id}: target for level ${bad.join(", ")} is not a positive number`);
      // Each level must be harder than the one before, all in the same direction (faster times or more reps).
      const nums = levelIds.map((id) => values[id]).filter((v) => Number.isFinite(v));
      const ups = nums.slice(1).map((v, i) => Math.sign(v - nums[i]));
      if (nums.length === levelIds.length && ups.length > 0 && !(ups.every((d) => d > 0) || ups.every((d) => d < 0))) {
        errors.push(`${s.id}: targets must get harder at every level, all in the same direction`);
      }
    } else if (!/\d/.test(s.test)) {
      errors.push(`${s.id}: test has no number in it, so nobody can tell when they've passed`);
    }
    errors.push(...checkErrors(s));
  }
  const roots = tree.skills.filter((s) => s.requires.length === 0);
  if (roots.length !== 1) errors.push(`Tree needs exactly 1 start skill, found ${roots.length}`);
  const lastLevel = tree.levels[tree.levels.length - 1];
  if (lastLevel && lastLevel.at !== tree.skills.length) {
    errors.push(`Top level "${lastLevel.name}" is at ${lastLevel.at}, but the tree has ${tree.skills.length} skills`);
  }
  const byId = new Map(tree.skills.map((s) => [s.id, s]));
  for (const s of tree.skills) {
    for (const r of s.requires) {
      const parent = byId.get(r);
      if (!parent) errors.push(`${s.id}: requires unknown skill ${r}`);
      else if (parent.row >= s.row) errors.push(`${s.id}: requires ${r}, which is not on an earlier row`);
    }
  }
  return errors;
}

/** Mistakes in a skill's `check`: missing, impossible numbers, or numbers that don't match the test sentence. */
function checkErrors(s: Skill): string[] {
  const c: TestCheck | undefined = s.check;
  if (!c) return [`${s.id}: has no check, so test mode can't count or time it`];
  const errors: string[] = [];
  const positive = (name: string, v: number | undefined) => {
    if (v !== undefined && !(Number.isFinite(v) && v > 0)) errors.push(`${s.id}: check ${name} must be a positive number`);
  };
  // "8 of 10" must say 8 and 10. Whole words only, so 10 doesn't match inside 100.
  const inText = (name: string, v: number) => {
    if (!new RegExp(`(^|[^\\d.])${v}([^\\d.]|$)`).test(s.test)) errors.push(`${s.id}: check ${name} ${v} isn't in the test text`);
  };
  switch (c.kind) {
    case "hits":
      positive("needed", c.needed);
      positive("attempts", c.attempts);
      positive("seconds", c.seconds);
      if (c.needed > c.attempts) errors.push(`${s.id}: check needs ${c.needed} hits from only ${c.attempts} attempts`);
      inText("needed", c.needed);
      inText("attempts", c.attempts);
      break;
    case "count":
      positive("needed", c.needed);
      positive("seconds", c.seconds);
      inText("needed", c.needed);
      break;
    case "time":
      positive("under", c.under);
      positive("tries", c.tries);
      positive("reps", c.reps);
      if (c.under === undefined && !s.targets) errors.push(`${s.id}: timed check has no limit: give it under, or targets`);
      if (c.tries !== undefined && c.reps !== undefined) errors.push(`${s.id}: timed check can be best of tries or every one of reps, not both`);
      break;
    case "hold":
      positive("seconds", c.seconds);
      inText("seconds", c.seconds);
      break;
  }
  return errors;
}
