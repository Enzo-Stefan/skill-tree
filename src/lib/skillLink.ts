import type { Tree } from "../types";

// A link to one skill, e.g. https://host/?skill=ps3. The id goes in the query, not the # part:
// Google sign-in comes back with its tokens in the # part.

const PARAM = "skill";

/** The tree and skill a link points to, or null when there's no ?skill= or no tree has that id. */
export function skillFromSearch(trees: Tree[], search: string): { tree: Tree; skillId: string } | null {
  const id = new URLSearchParams(search).get(PARAM);
  if (!id) return null;
  for (const tree of trees) {
    if (tree.skills.some((s) => s.id === id)) return { tree, skillId: id };
  }
  return null;
}

/** The link to a skill, on the given page address. Drops any other query and the # part. */
export function skillUrl(pageHref: string, skillId: string): string {
  const url = new URL(pageHref);
  url.search = "";
  url.hash = "";
  url.searchParams.set(PARAM, skillId);
  return url.toString();
}

/** The address with ?skill= removed, so reloading or switching trees doesn't reopen the link. */
export function withoutSkillParam(pageHref: string): string {
  const url = new URL(pageHref);
  url.searchParams.delete(PARAM);
  return url.toString();
}
