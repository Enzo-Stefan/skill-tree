import type { SupabaseClient } from "@supabase/supabase-js";
import type { Hemisphere, LeaderboardProfile, LeaderboardRow, LeaderboardScope, Tree } from "../types";
import { countryByCode } from "../data/countries";
import { CITY_MAX, continentOf, displayNameError, hemisphereFor, LEADERBOARD_LIMIT, normalizeCity } from "./leaderboard";
import { STEPS_PER_LEVEL } from "./progress";

// What the leaderboard screens need on top of the rules in leaderboard.ts: calls to Supabase and a few
// helpers for showing a player's place (#96). The ranking itself happens in the database.

/** The one tree the leaderboard covers at launch. */
export const LEADERBOARD_TREE = "football";
/** The only single test that can be ranked on its own at launch: the 30 m sprint. */
export const SPRINT_TEST = "ft2";

export type NameProblem = "short" | "long" | "characters" | "blocked";

/** What is wrong with a display name, or null when it is fine. Same rules as the database. */
export function nameProblem(raw: string): NameProblem | null {
  const error = displayNameError(raw);
  if (error === "too-short") return "short";
  if (error === "too-long") return "long";
  return error;
}

/** True when the player must say which hemisphere they live in, because the country spans the equator. */
export function needsHemispherePick(countryCode: string | null): boolean {
  return countryByCode(countryCode)?.crossesEquator === true;
}

/** The flag emoji for an ISO country code; an empty string when there is none. */
export function flagEmoji(countryCode: string | null): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return "";
  return String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** The country's name in the given language, from the browser. Falls back to the English name. */
export function countryName(countryCode: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
  } catch {
    return countryByCode(countryCode)?.name ?? countryCode;
  }
}

/** Which scopes a player can look at, given what they have filled in. Global is always possible. */
export function scopeAvailable(scope: LeaderboardScope, profile: LeaderboardProfile | null): boolean {
  if (scope === "global") return true;
  if (!profile) return false;
  if (scope === "continent") return continentOf(profile.countryCode) !== null;
  if (scope === "hemisphere") return hemisphereFor(profile.countryCode, profile.hemisphere) !== null;
  if (scope === "country") return profile.countryCode !== null;
  return profile.countryCode !== null && normalizeCity(profile.city) !== null;
}

/** Where a level step (1 to 16) sits, as "Advanced 2". Null when the tree has no such level. */
export function levelStepName(tree: Tree, levelStep: number): string | null {
  const level = (tree.playerLevels ?? [])[Math.floor((levelStep - 1) / STEPS_PER_LEVEL)];
  return level ? `${level.name} ${((levelStep - 1) % STEPS_PER_LEVEL) + 1}` : null;
}

// ---- Supabase calls ----

export type LeaderboardErrorCode = "taken" | "blocked" | "failed";

export class LeaderboardError extends Error {
  readonly code: LeaderboardErrorCode;
  constructor(code: LeaderboardErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface ProfileRow {
  display_name: string;
  country_code: string | null;
  city: string | null;
  hemisphere: Hemisphere | null;
  leaderboard_opt_in: boolean;
}

/** The player's own profile, or null if they never made one. */
export async function fetchProfile(client: SupabaseClient, userId: string): Promise<LeaderboardProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("display_name, country_code, city, hemisphere, leaderboard_opt_in")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw new LeaderboardError("failed", error.message);
  if (!data) return null;
  return {
    displayName: data.display_name,
    countryCode: data.country_code,
    city: data.city,
    hemisphere: data.hemisphere,
    leaderboardOptIn: data.leaderboard_opt_in,
  };
}

/** What gets saved: text trimmed, and the hemisphere worked out from the country unless the player has to pick. */
export function profileToRow(userId: string, profile: LeaderboardProfile) {
  const countryCode = profile.countryCode && countryByCode(profile.countryCode) ? profile.countryCode.toUpperCase() : null;
  const city = profile.city?.trim().slice(0, CITY_MAX) ?? "";
  return {
    user_id: userId,
    display_name: profile.displayName.trim(),
    country_code: countryCode,
    city: city === "" ? null : city,
    hemisphere: hemisphereFor(countryCode, profile.hemisphere),
    leaderboard_opt_in: profile.leaderboardOptIn,
  };
}

/** Saves the profile. Throws a LeaderboardError with "taken" when another player has the name. */
export async function saveProfile(client: SupabaseClient, userId: string, profile: LeaderboardProfile): Promise<void> {
  if (nameProblem(profile.displayName)) throw new LeaderboardError("blocked", "name");
  const { error } = await client.from("profiles").upsert(profileToRow(userId, profile), { onConflict: "user_id" });
  if (!error) return;
  if (error.code === "23505") throw new LeaderboardError("taken", error.message);
  if (error.code === "23514" || error.code === "P0001") throw new LeaderboardError("blocked", error.message);
  throw new LeaderboardError("failed", error.message);
}

interface BoardRow {
  rank: number | string;
  display_name: string;
  country_code: string | null;
  skills: number | string;
  level_step: number | string;
  best_sprint: number | string | null;
  is_me: boolean;
}

export interface LeaderboardResult {
  top: LeaderboardRow[];
  /** The player's own row when it sits below the top, otherwise null. */
  me: LeaderboardRow | null;
}

/** Maps the rows the database returns, and splits the player's own row off when it comes after the top 50. */
export function toResult(rows: BoardRow[]): LeaderboardResult {
  const mapped: LeaderboardRow[] = rows.map((r) => ({
    rank: Number(r.rank),
    displayName: r.display_name,
    countryCode: r.country_code,
    skills: Number(r.skills),
    levelStep: Number(r.level_step),
    bestSprint: r.best_sprint === null ? null : Number(r.best_sprint),
    isMe: r.is_me,
  }));
  return { top: mapped.slice(0, LEADERBOARD_LIMIT), me: mapped.length > LEADERBOARD_LIMIT ? mapped[LEADERBOARD_LIMIT] : null };
}

/** The ranking for one scope, ranked by the sprint alone when `sprintOnly` is set. */
export async function fetchLeaderboard(
  client: SupabaseClient,
  scope: LeaderboardScope,
  treeId: string,
  sprintOnly: boolean,
): Promise<LeaderboardResult> {
  const { data, error } = await client.rpc("leaderboard", {
    scope,
    tree_id: treeId,
    test_id: sprintOnly ? SPRINT_TEST : null,
  });
  if (error) throw new LeaderboardError("failed", error.message);
  return toResult((data ?? []) as BoardRow[]);
}
