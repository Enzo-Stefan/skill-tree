import { XP_AMOUNTS, XP_LEVEL_STEP } from "../data/xp";

// XP (#121). Every award has an event key ("skill:bc1:pass"), and a key can only be in the ledger once, so the
// same thing never pays twice, on one device, offline, on two devices, or after a sync merge. Undoing a pass
// switches its event off, so its XP goes; passing again switches it back on. The ledger is a list of events:
//
//   { key, xp, active, at }
//
// `xp` is the amount given at the time (changing src/data/xp.ts never changes what was already earned),
// `at` is when the event last changed. Two copies merge key by key and the later `at` wins (mergeEvents), so
// the result does not depend on which device syncs first. Saved in the account's `xp_events` table
// (supabase/migrations/007_xp.sql), where a unique constraint on (player, tree, key) is the last line of defence.

export interface XpEvent {
  key: string;
  xp: number;
  active: boolean;
  /** ISO time of the last change. */
  at: string;
}

/** Most events kept per tree, as a backstop. A full football tree is far below this. */
export const MAX_XP_EVENTS = 6000;
/** Largest amount one event can be worth. */
export const MAX_EVENT_XP = 10000;

// ---- Event keys ----

export type MasteryTier = "bronze" | "silver" | "gold";

export const skillPassKey = (skillId: string) => `skill:${skillId}:pass`;
export const sessionKey = (day: string) => `session:${day}`;
/** period is the day for a daily challenge and the week's Monday for a weekly one. */
/** One award per day and skill for completing that day's mission. */
export const missionKey = (day: string, skillId: string) => `mission:${day}:${skillId}`;
export const challengeKey = (challengeId: string, period: string) => `challenge:${challengeId}:${period}`;
export const masteryKey = (skillId: string, tier: MasteryTier) => `mastery:${skillId}:${tier}`;
/**
 * A streak milestone. `run` says which streak it belongs to: the week the streak started after (a level step restarts
 * the streak), or nothing for the first one. One award per milestone per run, so a new streak can earn them again.
 */
export const streakKey = (weeks: number, run: string | null) => `streak:${weeks}:${run ?? "start"}`;
/**
 * The day a skill was passed, written when the pass happens (a marker worth nothing). Challenges count passes from
 * these, not from the time the app first noticed a pass, so old passes never count toward today's goals.
 */
export const passDayKey = (skillId: string, day: string) => `passday:${skillId}:${day}`;
export const achievementKey = (id: string) => `achievement:${id}`;

const KEY = /^[a-z]+:[A-Za-z0-9_.:-]{1,90}$/;

/** True for a key this app could have made. */
export function isEventKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= 100 && KEY.test(key);
}

/** The fourth part of a key like stepat:<skill>:<tier>:<step>, or an empty string. */
function parts4(key: string): string {
  const parts = key.split(":");
  return parts.length === 4 && /^(bronze|silver|gold)$/.test(parts[2]!) ? parts[3]! : "";
}

/** What a new event with this key is worth today, or null when the key is not one we award for. */
export function amountFor(key: string, weekly = false): number | null {
  if (!isEventKey(key)) return null;
  const [kind, a, b] = key.split(":");
  switch (kind) {
    case "skill":
      return b === "pass" && key.split(":").length === 3 ? XP_AMOUNTS.skill : null;
    case "session":
      return XP_AMOUNTS.session;
    case "mission":
      return XP_AMOUNTS.mission;
    case "challenge":
      if (b?.startsWith("season-")) return XP_AMOUNTS.challengeSeason;
      return weekly ? XP_AMOUNTS.challengeWeekly : XP_AMOUNTS.challengeDaily;
    case "mastery":
      return b === "bronze" || b === "silver" || b === "gold" ? XP_AMOUNTS.mastery[b] : null;
    case "streak": {
      // Only the shapes streakKey makes ("streak:4:start", "streak:4:2026-11-02"), not "streak:4", "streak:04" or "streak:4:x".
      const parts = key.split(":");
      if (parts.length !== 3 || String(Number(a)) !== a || !/^(start|\d{4}-\d{2}-\d{2})$/.test(parts[2]!)) return null;
      return XP_AMOUNTS.streak[Number(a)] ?? null;
    }
    case "passday":
      return key.split(":").length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(b ?? "") ? 0 : null;
    case "achievement":
      return XP_AMOUNTS.achievement;
    case "stepat":
      // The step a mastery tier was earned at (src/lib/mastery.ts): a marker worth nothing.
      return /^\d{1,2}$/.test(parts4(key)) ? 0 : null;
    default:
      return null;
  }
}

// ---- Awarding ----

/**
 * The ledger with `key` awarded. Awarding a key that is already on does nothing and returns the same list,
 * so calling it twice, or from two places, pays once. A key that was switched off (an undone pass) is switched
 * back on and keeps the amount it was first given. `xp` is the amount for a new key; null means "not a key we
 * award", and the ledger is returned unchanged.
 */
export function award(events: XpEvent[], key: string, xp: number | null, now: string): XpEvent[] {
  const existing = events.find((e) => e.key === key);
  if (existing?.active) return events;
  if (existing) return events.map((e) => (e.key === key ? { ...e, active: true, at: changedAt(existing.at, now) } : e));
  if (xp === null || !isEventKey(key) || !Number.isInteger(xp) || xp < 0 || xp > MAX_EVENT_XP) return events;
  return [...events, { key, xp, active: true, at: now }];
}

/** The ledger with `key` switched off. Does nothing when it was never awarded or is already off. */
export function revoke(events: XpEvent[], key: string, now: string): XpEvent[] {
  const existing = events.find((e) => e.key === key);
  if (!existing || !existing.active) return events;
  return events.map((e) => (e.key === key ? { ...e, active: false, at: changedAt(existing.at, now) } : e));
}

/**
 * The time to stamp on a change to an event that was last changed at `previous`: now, but never earlier than
 * 1 ms after `previous`. A device whose clock is behind (or an event that came from a device whose clock was
 * ahead) still wins against the version it replaces, so an undo or a re-pass made here is never lost to it.
 */
function changedAt(previous: string, now: string): string {
  const p = Date.parse(previous);
  const n = Date.parse(now);
  if (Number.isNaN(n)) return Number.isNaN(p) ? now : new Date(p + 1).toISOString();
  return Number.isNaN(p) || n > p ? now : new Date(p + 1).toISOString();
}

export function totalXp(events: XpEvent[]): number {
  return events.reduce((sum, e) => sum + (e.active ? e.xp : 0), 0);
}

export function hasAward(events: XpEvent[], key: string): boolean {
  return events.some((e) => e.key === key && e.active);
}

// ---- Level ----

export interface XpLevel {
  level: number;
  /** XP earned inside this level. */
  into: number;
  /** XP this level is long. */
  span: number;
  /** 0 to 1. */
  progress: number;
}

/** The XP level for a total: level 1 from 0 XP, then XP_LEVEL_STEP * (n - 1)^2 to reach level n. */
export function xpLevel(total: number): XpLevel {
  const xp = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const level = Math.floor(Math.sqrt(xp / XP_LEVEL_STEP)) + 1;
  const start = XP_LEVEL_STEP * (level - 1) ** 2;
  const span = XP_LEVEL_STEP * level ** 2 - start;
  return { level, into: xp - start, span, progress: (xp - start) / span };
}

// ---- Cleaning and merging ----

const isIso = (s: unknown): s is string => typeof s === "string" && s.length <= 40 && !Number.isNaN(Date.parse(s));

/** Drops anything broken (unknown shape, bad key, bad amount, bad time) and duplicate keys (the later one stays). */
export function cleanEvents(raw: unknown): XpEvent[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, XpEvent>();
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const { key, xp, active, at } = e as Partial<XpEvent>;
    if (!isEventKey(key) || typeof xp !== "number" || !Number.isInteger(xp) || xp < 0 || xp > MAX_EVENT_XP) continue;
    if (typeof active !== "boolean" || !isIso(at)) continue;
    const next = { key, xp, active, at: new Date(at).toISOString() };
    const prev = byKey.get(key);
    byKey.set(key, prev ? winner(prev, next) : next);
  }
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, MAX_XP_EVENTS);
}

/**
 * The event that wins for one key. The later change decides `active` and `at`; on the same instant the switched-off
 * one wins, so a tie never over-awards. The amount is always the smaller of the two: an event is worth what it
 * was first given, and a copy carrying a bigger amount (a retune, a bad client) never raises it. The database
 * (supabase/migrations/009_xp_fixes.sql) applies the same rule, so both sides end with the same row.
 */
function winner(a: XpEvent, b: XpEvent): XpEvent {
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  let w: XpEvent;
  if (ta !== tb) w = ta > tb ? a : b;
  else if (a.active !== b.active) w = a.active ? b : a;
  else w = a;
  return { key: w.key, xp: Math.min(a.xp, b.xp), active: w.active, at: w.at };
}

/**
 * Two ledgers (this browser and the account, or two devices) as one. Per key the later change wins, so an undo
 * on one device and a later re-pass on the other end up as the re-pass, and the order of the merge does not
 * matter (a merge is the same both ways round, and merging again changes nothing).
 */
export function mergeEvents(a: unknown, b: unknown): XpEvent[] {
  return cleanEvents([...cleanEvents(a), ...cleanEvents(b)]);
}
