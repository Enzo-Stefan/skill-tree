// Merging two lists of logged entries (lifts, test results) where the same entry can honestly
// appear more than once: two sessions at 60 kg on the same day are two entries. So the lists are
// compared as counts per entry, not as sets. Used by the account sync (src/lib/cloud.ts, sync.ts).

type Counts<T> = Map<string, { entry: T; count: number }>;

function count<T>(list: T[], key: (e: T) => string): Counts<T> {
  const counts: Counts<T> = new Map();
  for (const e of list) {
    const k = key(e);
    const seen = counts.get(k);
    if (seen) seen.count++;
    else counts.set(k, { entry: e, count: 1 });
  }
  return counts;
}

function expand<T>(counts: Counts<T>): T[] {
  const out: T[] = [];
  for (const { entry, count: n } of counts.values()) for (let i = 0; i < n; i++) out.push(entry);
  return out;
}

/**
 * Both lists together, for the first sign-in on a device. An entry in both counts once (the same
 * session synced earlier), so the most times an entry appears in either list is kept.
 */
export function mergeCounted<T>(a: T[], b: T[], key: (e: T) => string): T[] {
  const counts = count(a, key);
  for (const [k, theirs] of count(b, key)) {
    const ours = counts.get(k);
    if (!ours || theirs.count > ours.count) counts.set(k, theirs);
  }
  return expand(counts);
}

/**
 * The changes made here since `from` (entries added or removed), applied on top of `onto`.
 * So an entry added here is added to the account's list, and an entry undone or reset here is
 * taken out of it, while entries from other devices stay.
 *
 * Replaying can happen twice: a save can reach the account just before the page closes, before
 * this browser notes it. So an entry added here is never counted more times than this browser
 * has it (or the account already had it). The cost: the same entry added on two devices before
 * either syncs counts once.
 */
export function replayCounted<T>(onto: T[], from: T[], to: T[], key: (e: T) => string): T[] {
  const out = count(onto, key);
  const before = count(from, key);
  const after = count(to, key);
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const here = after.get(k)?.count ?? 0;
    const change = here - (before.get(k)?.count ?? 0);
    if (change === 0) continue;
    const entry = (after.get(k) ?? before.get(k))!.entry;
    const there = out.get(k)?.count ?? 0;
    const n = change > 0 ? Math.min(there + change, Math.max(there, here)) : Math.max(0, there + change);
    if (n === 0) out.delete(k);
    else out.set(k, { entry, count: n });
  }
  return expand(out);
}
