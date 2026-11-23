import type { Level, Skill, SkillState, Tree } from "../types";

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

const storageKey = (treeId: string) => `skill-tree:${treeId}`;

export function loadProgress(treeId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey(treeId)) ?? "[]"));
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

export function progressSummary(tree: Tree, done: Set<string>): string {
  const { current } = levelInfo(tree.levels, done.size);
  const lines = tree.branches.map((b) => {
    const skills = tree.skills.filter((s) => s.branch === b.id);
    const count = skills.filter((s) => done.has(s.id)).length;
    return `${b.name}: ${count}/${skills.length}`;
  });
  return [`My ${tree.title}: ${done.size}/${tree.skills.length} skills, level ${current.name}.`, ...lines].join("\n");
}

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
