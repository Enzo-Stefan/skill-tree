// Which account the copies kept in this browser belong to (#139). Progress, the XP ledger and the rating history
// are saved here for the player who last signed in. When a different account signs in on the same browser, those
// copies are not theirs: they are replaced by the new account's own data instead of being merged into it.
// A browser that has never held an account (a guest) has no owner, so a guest's progress still merges on sign-in.

const key = (treeId: string, kind: string) => `skill-tree:${treeId}:${kind}-owner`;

/** The user id this browser's copy of `kind` ("xp", "ratings") belongs to, or null for a guest. */
export function getOwner(treeId: string, kind: string): string | null {
  try {
    return localStorage.getItem(key(treeId, kind));
  } catch {
    return null;
  }
}

export function setOwner(treeId: string, kind: string, userId: string): void {
  try {
    localStorage.setItem(key(treeId, kind), userId);
  } catch {
    // Storage can be blocked. Then the next sign-in cannot tell, and merges as for a guest.
  }
}

/** True when the browser's copy belongs to a different account than `userId`. */
export function belongsToAnother(treeId: string, kind: string, userId: string): boolean {
  const owner = getOwner(treeId, kind);
  return owner !== null && owner !== userId;
}
