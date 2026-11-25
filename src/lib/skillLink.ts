import type { Tree } from "../types";

// A link to one skill, e.g. https://host/?tree=football&skill=ps3. The params go in the query, not the # part:
// Google sign-in comes back with its tokens in the # part.

const SKILL_PARAM = "skill";
const TREE_PARAM = "tree";

/**
 * The tree and skill a link points to, or null when there's no ?skill= or no tree has that skill.
 * A ?tree= that names a tree which has the skill wins, since skill ids such as "root" repeat across trees.
 * Otherwise the first tree that has the skill is used.
 */
export function skillFromSearch(trees: Tree[], search: string): { tree: Tree; skillId: string } | null {
  const params = new URLSearchParams(search);
  const skillId = params.get(SKILL_PARAM);
  if (!skillId) return null;
  const treeId = params.get(TREE_PARAM);
  const named = treeId ? trees.find((t) => t.id === treeId && t.skills.some((s) => s.id === skillId)) : undefined;
  if (named) return { tree: named, skillId };
  for (const tree of trees) {
    if (tree.skills.some((s) => s.id === skillId)) return { tree, skillId };
  }
  return null;
}

/**
 * The link to a skill, on the given page address. Drops any other query and the # part.
 * With a treeId, the link names the tree too (?tree=...&skill=...), so shared ids resolve to the right tree.
 */
export function skillUrl(pageHref: string, skillId: string, treeId?: string): string {
  const url = new URL(pageHref);
  url.search = "";
  url.hash = "";
  if (treeId) url.searchParams.set(TREE_PARAM, treeId);
  url.searchParams.set(SKILL_PARAM, skillId);
  return url.toString();
}

/** The address with ?tree= and ?skill= removed, so reloading or switching trees doesn't reopen the link. */
export function withoutSkillParam(pageHref: string): string {
  const url = new URL(pageHref);
  url.searchParams.delete(TREE_PARAM);
  url.searchParams.delete(SKILL_PARAM);
  return url.toString();
}
