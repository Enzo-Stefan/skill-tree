import type { SupabaseClient } from "@supabase/supabase-js";
import { weekOf, type WeekKey } from "./streak";
import type { Ratings } from "./ratings";

// The weekly rating snapshots (#123 item 5): one per week (the week's Monday) with the six branch ratings and the
// overall, so the career page (#124) can draw how a player developed. The newest copy of a week wins. Kept in this
// browser and, when signed in, in the account (supabase/migrations/008_ratings.sql).

export interface RatingSnapshot {
  week: WeekKey;
  ratings: Record<string, number>;
  overall: number;
  /** ISO time of the last change. */
  at: string;
}

/** Most weeks kept, about ten years. */
export const MAX_SNAPSHOTS = 520;

const isIso = (s: unknown): s is string => typeof s === "string" && s.length <= 40 && !Number.isNaN(Date.parse(s));
const isRating = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 99;

function isMonday(week: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && date.getUTCDay() === 1;
}

const sameRatings = (a: Record<string, number>, b: Record<string, number>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/**
 * The history with this week's snapshot set to `ratings`. Returns the same list when this week already holds
 * the same numbers, so nothing is saved for no change. Only the current week is ever written by the app.
 */
export function recordWeek(history: RatingSnapshot[], today: string, ratings: Ratings, now: string): RatingSnapshot[] {
  const week = weekOf(today);
  const existing = history.find((s) => s.week === week);
  if (existing && existing.overall === ratings.overall && sameRatings(existing.ratings, ratings.branches)) return history;
  const next: RatingSnapshot = { week, ratings: { ...ratings.branches }, overall: ratings.overall, at: now };
  return cleanSnapshots([...history.filter((s) => s.week !== week), next]);
}

/** Drops anything broken (not a Monday, a rating outside 0 to 99, a bad time) and duplicate weeks (the later change stays). */
export function cleanSnapshots(raw: unknown): RatingSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const byWeek = new Map<string, RatingSnapshot>();
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const { week, ratings, overall, at } = e as Partial<RatingSnapshot>;
    if (typeof week !== "string" || !isMonday(week) || !isRating(overall) || !isIso(at)) continue;
    if (typeof ratings !== "object" || ratings === null || Array.isArray(ratings)) continue;
    const entries = Object.entries(ratings);
    if (entries.length > 12 || !entries.every(([k, v]) => /^[a-z0-9_-]{1,32}$/.test(k) && isRating(v))) continue;
    const next: RatingSnapshot = { week, ratings: { ...ratings }, overall, at };
    const prev = byWeek.get(week);
    if (!prev || Date.parse(next.at) > Date.parse(prev.at)) byWeek.set(week, next);
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-MAX_SNAPSHOTS);
}

/** Two histories as one: per week the later change wins, so the order of the merge does not matter. */
export function mergeSnapshots(a: unknown, b: unknown): RatingSnapshot[] {
  return cleanSnapshots([...cleanSnapshots(a), ...cleanSnapshots(b)]);
}

export function sameSnapshots(a: RatingSnapshot[], b: RatingSnapshot[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const byWeek = new Map(b.map((s) => [s.week, s]));
  return a.every((s) => {
    const o = byWeek.get(s.week);
    return o !== undefined && o.at === s.at && o.overall === s.overall && sameRatings(o.ratings, s.ratings);
  });
}

// ---- This browser ----

const storageKey = (treeId: string) => `skill-tree:${treeId}:ratings`;

export function loadSnapshots(treeId: string): RatingSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(treeId));
    return raw ? cleanSnapshots(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveSnapshots(treeId: string, history: RatingSnapshot[]): void {
  try {
    localStorage.setItem(storageKey(treeId), JSON.stringify(history));
  } catch {
    // Storage can be full or blocked. The next week's snapshot is taken again.
  }
}

// ---- The account ----

interface Row {
  week: string;
  ratings: unknown;
  overall: number;
  at: string;
}

/** The account's history for a tree. Throws when the call fails, so the caller keeps its own copy. */
export async function fetchSnapshots(client: SupabaseClient, treeId: string): Promise<RatingSnapshot[]> {
  const { data, error } = await client.from("rating_snapshots").select("week, ratings, overall, at").eq("tree_id", treeId).limit(MAX_SNAPSHOTS);
  if (error) throw new Error(error.message);
  return cleanSnapshots(((data ?? []) as Row[]).map((r) => ({ week: r.week, ratings: r.ratings, overall: r.overall, at: r.at })));
}

/** Saves a history to the account, 300 snapshots at a time (the most save_rating_snapshots accepts). */
export async function pushSnapshots(client: SupabaseClient, treeId: string, history: RatingSnapshot[]): Promise<void> {
  for (let i = 0; i < history.length; i += 300) {
    const { error } = await client.rpc("save_rating_snapshots", { p_tree_id: treeId, p_snapshots: history.slice(i, i + 300) });
    if (error) throw new Error(error.message);
  }
}

// ---- Position and preferred foot (private) ----

export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";
export type PreferredFoot = "left" | "right" | "both";
export const POSITIONS: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];
export const FEET: PreferredFoot[] = ["left", "right", "both"];

export interface PlayerCard {
  position: PlayerPosition | null;
  foot: PreferredFoot | null;
}

export async function fetchCard(client: SupabaseClient, userId: string): Promise<PlayerCard> {
  const { data, error } = await client.from("player_cards").select("player_position, preferred_foot").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const p = (data as { player_position: string | null; preferred_foot: string | null } | null) ?? { player_position: null, preferred_foot: null };
  return {
    position: POSITIONS.includes(p.player_position as PlayerPosition) ? (p.player_position as PlayerPosition) : null,
    foot: FEET.includes(p.preferred_foot as PreferredFoot) ? (p.preferred_foot as PreferredFoot) : null,
  };
}

export async function saveCard(client: SupabaseClient, userId: string, card: PlayerCard): Promise<void> {
  const { error } = await client.from("player_cards").upsert({ user_id: userId, player_position: card.position, preferred_foot: card.foot }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
