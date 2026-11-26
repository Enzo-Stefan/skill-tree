import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";
import { amountFor, award, cleanEvents, revoke, sessionKey, skillPassKey, type XpEvent } from "./xp";

// Keeps the XP ledger (src/lib/xp.ts) in step with what the player has done, and saves it: in this browser
// and, when signed in, in the account (supabase/migrations/007_xp.sql). XP is worked out from the finished
// skills and the training days, so un-ticking a skill takes its XP away, a skill finished on another device
// earns its XP here too, and players who already had progress get their XP the first time it runs.

/**
 * The ledger after bringing it in line with `done` (finished skill ids) and `practiceDays`:
 * every finished skill has its pass awarded, a pass for a skill that is no longer finished is switched
 * off, and every training day has its session awarded. Returns the same list when nothing changed.
 */
export function reconcile(tree: Tree, events: XpEvent[], done: Iterable<string>, practiceDays: string[], now: string): XpEvent[] {
  const doneSet = new Set(done);
  let next = events;
  for (const skill of tree.skills) {
    if (doneSet.has(skill.id)) next = award(next, skillPassKey(skill.id), amountFor(skillPassKey(skill.id)), now);
  }
  for (const e of events) {
    // A skill's pass, the day marker written with it, and its mastery tiers and the steps they were earned at, go when the skill is un-ticked.
    const m = /^(?:skill:(.+):pass|passday:(.+):\d{4}-\d{2}-\d{2}|mastery:(.+):(?:bronze|silver|gold)|stepat:(.+):(?:bronze|silver|gold):\d{1,2})$/.exec(e.key);
    const skillId = m ? (m[1] ?? m[2] ?? m[3] ?? m[4]) : null;
    if (skillId && e.active && !doneSet.has(skillId)) next = revoke(next, e.key, now);
  }
  for (const day of practiceDays) next = award(next, sessionKey(day), amountFor(sessionKey(day)), now);
  return next;
}

// ---- This browser ----

const storageKey = (treeId: string) => `skill-tree:${treeId}:xp`;

export function loadXp(treeId: string): XpEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(treeId));
    return raw ? cleanEvents(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveXp(treeId: string, events: XpEvent[]): void {
  try {
    localStorage.setItem(storageKey(treeId), JSON.stringify(events));
  } catch {
    // Storage can be full or blocked. The ledger is rebuilt from the progress next time.
  }
}

// ---- The account ----

interface Row {
  event_key: string;
  xp: number;
  active: boolean;
  at: string;
}

/** The account's ledger for a tree. Throws when the call fails, so the caller can leave things as they are. */
export async function fetchXp(client: SupabaseClient, treeId: string): Promise<XpEvent[]> {
  const { data, error } = await client.from("xp_events").select("event_key, xp, active, at").eq("tree_id", treeId).limit(6000);
  if (error) throw new Error(error.message);
  return cleanEvents(((data ?? []) as Row[]).map((r) => ({ key: r.event_key, xp: r.xp, active: r.active, at: r.at })));
}

/** Saves a ledger to the account, 500 events at a time (the most save_xp_events accepts). */
export async function pushXp(client: SupabaseClient, treeId: string, events: XpEvent[]): Promise<void> {
  for (let i = 0; i < events.length; i += 500) {
    const { error } = await client.rpc("save_xp_events", { p_tree_id: treeId, p_events: events.slice(i, i + 500) });
    if (error) throw new Error(error.message);
  }
}

/** True when two ledgers hold the same events, so nothing needs saving. */
export function sameEvents(a: XpEvent[], b: XpEvent[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const byKey = new Map(b.map((e) => [e.key, e]));
  return a.every((e) => {
    const o = byKey.get(e.key);
    return o !== undefined && o.xp === e.xp && o.active === e.active && o.at === e.at;
  });
}
