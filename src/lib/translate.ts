import type { Tree } from "../types";

// Skill content in other languages (step 7 of #19).
//
// A tree's structure (ids, unlock order, positions, targets, videos) lives once, in English, in
// src/data/<tree>.ts. Each other language adds one translation file per tree with only the words,
// keyed by id. Anything a translation leaves out shows in English, so a half-done language still
// works. translationErrors() is run by the tests, so a typo'd id or a missing piece fails the build.

/** The words of one skill. */
export interface SkillText {
  name: string;
  drill: string;
  test: string;
  tip: string;
  /** The level target sentence, with `{n}` where the number goes. Only for skills with targets. */
  targetText?: string;
}

/** The words of one tree in one language. */
export interface TreeTranslation {
  title: string;
  shortName?: string;
  tagline: string;
  /** Branch names by branch id. */
  branches: Record<string, string>;
  /** Rank names, in the same order as the tree's levels. */
  levels: string[];
  /** Player level names and hints by player level id. */
  playerLevels?: Record<string, { name: string; hint: string }>;
  /** Skill words by skill id. */
  skills: Record<string, SkillText>;
}

/** The tree with the translation's words, falling back to English for anything it leaves out. */
export function translateTree(tree: Tree, tr: TreeTranslation | undefined): Tree {
  if (!tr) return tree;
  return {
    ...tree,
    title: tr.title || tree.title,
    shortName: tr.shortName ?? tree.shortName,
    tagline: tr.tagline || tree.tagline,
    branches: tree.branches.map((b) => ({ ...b, name: tr.branches[b.id] ?? b.name })),
    levels: tree.levels.map((l, i) => ({ ...l, name: tr.levels[i] ?? l.name })),
    playerLevels: tree.playerLevels?.map((l) => ({ ...l, ...tr.playerLevels?.[l.id] })),
    skills: tree.skills.map((s) => {
      const text = tr.skills[s.id];
      if (!text) return s;
      return {
        ...s,
        name: text.name,
        drill: text.drill,
        test: text.test,
        tip: text.tip,
        targets: s.targets && text.targetText ? { ...s.targets, text: text.targetText } : s.targets,
      };
    }),
  };
}

/**
 * Mistakes in a translation: ids the tree doesn't have, anything the tree has that the
 * translation is missing, empty text, and target sentences without their `{n}`.
 */
export function translationErrors(tree: Tree, tr: TreeTranslation): string[] {
  const errors: string[] = [];
  const unknown = (kind: string, ids: string[], known: string[]) => {
    for (const id of ids) if (!known.includes(id)) errors.push(`${tree.id}: unknown ${kind} ${id}`);
  };
  const missing = (kind: string, ids: string[], have: string[]) => {
    for (const id of ids) if (!have.includes(id)) errors.push(`${tree.id}: no translation for ${kind} ${id}`);
  };
  const empty = (where: string, text: string | undefined) => {
    if (!text?.trim()) errors.push(`${tree.id}: ${where} is empty`);
  };

  empty("title", tr.title);
  empty("tagline", tr.tagline);
  if (tree.shortName) empty("shortName", tr.shortName);

  const branchIds = tree.branches.map((b) => b.id);
  unknown("branch", Object.keys(tr.branches), branchIds);
  missing("branch", branchIds, Object.keys(tr.branches));
  for (const [id, name] of Object.entries(tr.branches)) empty(`branch ${id}`, name);

  if (tr.levels.length !== tree.levels.length) {
    errors.push(`${tree.id}: ${tr.levels.length} rank names for ${tree.levels.length} ranks`);
  }
  tr.levels.forEach((name, i) => empty(`rank ${i + 1}`, name));

  const playerLevelIds = (tree.playerLevels ?? []).map((l) => l.id);
  const translatedLevels = Object.keys(tr.playerLevels ?? {});
  unknown("player level", translatedLevels, playerLevelIds);
  missing("player level", playerLevelIds, translatedLevels);
  for (const [id, l] of Object.entries(tr.playerLevels ?? {})) {
    empty(`player level ${id} name`, l.name);
    empty(`player level ${id} hint`, l.hint);
  }

  const skillIds = tree.skills.map((s) => s.id);
  unknown("skill", Object.keys(tr.skills), skillIds);
  missing("skill", skillIds, Object.keys(tr.skills));
  for (const s of tree.skills) {
    const text = tr.skills[s.id];
    if (!text) continue;
    for (const field of ["name", "drill", "test", "tip"] as const) empty(`${s.id} ${field}`, text[field]);
    if (s.targets) {
      if (!text.targetText) errors.push(`${tree.id}: ${s.id} has targets but no targetText`);
      else if (text.targetText.split("{n}").length !== 2) errors.push(`${tree.id}: ${s.id} targetText needs exactly one {n}`);
    } else if (text.targetText) {
      errors.push(`${tree.id}: ${s.id} has a targetText but the skill has no targets`);
    }
  }
  return errors;
}
