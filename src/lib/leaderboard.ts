import { countryByCode } from "../data/countries";
import type { Continent, Hemisphere, LeaderboardRow, LeaderboardScope } from "../types";

// The leaderboard's rules (#96), written once in TypeScript. The database does the real ranking and
// enforces the same rules in migration 005 (supabase/migrations/005_leaderboard.sql); these functions
// are the reference the tests hold both to, and what the app uses to check input before sending it.
//
// Players are ranked by a tuple, not a weighted sum: skills finished first, then level step, then the
// best 30 m sprint (lower is better, no time ranks last). Skills come first because players pick their
// own level, so level alone would let anyone claim the top by choosing Expert.

/** Most rows a ranking returns, before the viewer's own row is added. */
export const LEADERBOARD_LIMIT = 50;

/** The skill whose result is the 30 m sprint. */
export const SPRINT_SKILL_ID = "ft2";

/** Sprint times outside this range (seconds) are ignored, not stored. */
export const MIN_SPRINT_SECONDS = 3.6;
export const MAX_SPRINT_SECONDS = 15;

/** A best sprint can improve once per this long. The level step can rise by 1 once per this long. */
export const IMPROVE_EVERY_MS = 24 * 60 * 60 * 1000;

export const NAME_MIN = 3;
export const NAME_MAX = 20;
export const CITY_MAX = 60;

/** Level step 1 to 16: the player's level (0 to 3) times 4, plus their step inside it (1 to 4). */
export function levelStepOf(levelIds: string[], levelId: string | null, step: number): number {
  const index = levelId === null ? -1 : levelIds.indexOf(levelId);
  if (index < 0) return 0;
  return index * 4 + Math.min(4, Math.max(1, Math.round(step)));
}

// --- Location ---

export function continentOf(countryCode: string | null): Continent | null {
  return countryByCode(countryCode)?.continent ?? null;
}

/**
 * The hemisphere, worked out from the country's capital. Countries that cross the equator can't be
 * worked out, so the player's own pick is used (or null if they haven't picked). For every other
 * country the pick is ignored, so nobody can claim the wrong half. No city lookup, no GPS.
 */
export function hemisphereFor(countryCode: string | null, picked: Hemisphere | null): Hemisphere | null {
  const country = countryByCode(countryCode);
  if (!country) return null;
  if (country.crossesEquator) return picked;
  return country.capitalLat >= 0 ? "N" : "S";
}

/** A city for matching: trimmed, lower case, inner spaces collapsed. Null when empty. */
export function normalizeCity(city: string | null | undefined): string | null {
  const clean = (city ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return clean === "" ? null : clean.slice(0, CITY_MAX);
}

// --- Display names ---

// A short English and Spanish list, checked here and in the database. It is a first line of defence,
// not a complete filter: a fluent reader should extend it before launch, and reports catch the rest.
// Strong stems are blocked anywhere in the name ("xXfuckXx"). Short words are blocked only as a whole
// word, so "grape", "economy" and "computadora" stay fine.
export const BLOCKED_STEMS = ["fuck", "shit", "bitch", "cunt", "nigg", "whore", "hitler", "mierda", "pendejo", "cabron"];
export const BLOCKED_WORDS = [
  "fag", "slut", "rape", "nazi", "puta", "puto", "joder", "coño", "verga", "pija", "violar",
  "culo", "marica", "maricon", "chinga",
];
// Whole words also count with a plural ending ("culos", "putas", "maricones"). Kept identical to
// display_name_blocked in supabase/migrations/005_leaderboard.sql; a test compares the two lists.
const BLOCKED_WORD_PATTERN = new RegExp(`^(${BLOCKED_WORDS.join("|")})(s|es)?$`);

const LOOKALIKES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "$": "s", "@": "a", "!": "i" };
const ACCENTED = "áàäâéèëêíìïîóòöôúùüû";
const UNACCENTED = "aaaaeeeeiiiioooouuuu";

/** Lower case, look-alike symbols and listed accents turned into plain letters (ñ kept), the rest dropped. Same as the SQL function. */
function foldWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[013457$@!]/g, (c) => LOOKALIKES[c] ?? c)
    .replace(/[áàäâéèëêíìïîóòöôúùüû]/g, (c) => UNACCENTED[ACCENTED.indexOf(c)] ?? c)
    .replace(/[^a-zñ]/g, "");
}

function isBlockedName(name: string): boolean {
  const words = name.split(/[\s._-]+/).map(foldWord).filter(Boolean);
  const joined = words.join("");
  if (BLOCKED_STEMS.some((stem) => joined.includes(stem))) return true;
  // Spelled out letter by letter ("p u t a") also counts as the whole word.
  return BLOCKED_WORD_PATTERN.test(joined) || words.some((w) => BLOCKED_WORD_PATTERN.test(w));
}

/** Null if the name is fine, otherwise a short reason code the screen can translate. */
export function displayNameError(name: string): "too-short" | "too-long" | "characters" | "blocked" | null {
  const clean = name.trim();
  if (clean.length < NAME_MIN) return "too-short";
  if (clean.length > NAME_MAX) return "too-long";
  // Letters (any language), digits, spaces, dots, dashes and underscores. No "@", so no email addresses.
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(clean)) return "characters";
  if (isBlockedName(clean)) return "blocked";
  return null;
}

// --- Cheating limits ---

/** What the database keeps per player and tree. Times are when the value last changed. */
export interface ScoreSnapshot {
  skills: number;
  levelStep: number;
  bestSprint: number | null;
  sprintImprovedAt: number | null;
  levelStepRaisedAt: number | null;
}

/** What the player's progress says now. */
export interface ScoreInput {
  skills: number;
  levelStep: number;
  bestSprint: number | null;
}

export function sprintIsPossible(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= MIN_SPRINT_SECONDS && seconds <= MAX_SPRINT_SECONDS;
}

/** The fastest possible time in a list of 30 m results, or null. Impossible times can't hide a real one. */
export function bestPossibleSprint(times: number[]): number | null {
  const possible = times.filter(sprintIsPossible);
  return possible.length ? Math.min(...possible) : null;
}

/**
 * The stored score after the player's progress changed, with the cheating limits applied:
 * - an impossible sprint (under 3.6 s or over 15 s) is ignored;
 * - a best sprint can get faster once per 24 hours;
 * - the level step can rise by 1, once per 24 hours (the first score for a player is taken as it is).
 * Going down is always allowed, since players can undo skills or clear results.
 */
export function applyScoreUpdate(prev: ScoreSnapshot | null, input: ScoreInput, now: number): ScoreSnapshot {
  const skills = Math.max(0, Math.floor(input.skills));
  const wanted = Math.max(0, Math.min(16, Math.floor(input.levelStep)));
  const sprint = input.bestSprint !== null && sprintIsPossible(input.bestSprint) ? input.bestSprint : null;

  if (!prev) {
    return {
      skills,
      levelStep: wanted,
      bestSprint: sprint,
      sprintImprovedAt: sprint === null ? null : now,
      levelStepRaisedAt: null,
    };
  }

  let { levelStep, levelStepRaisedAt } = prev;
  if (wanted <= prev.levelStep) {
    levelStep = wanted;
  } else if (prev.levelStepRaisedAt === null || now - prev.levelStepRaisedAt >= IMPROVE_EVERY_MS) {
    levelStep = prev.levelStep + 1;
    levelStepRaisedAt = now;
  }

  let { bestSprint, sprintImprovedAt } = prev;
  if (sprint === null) {
    // Nothing usable now. If the player had cleared their times, so does the board; an impossible time just leaves things as they were.
    if (input.bestSprint === null) {
      bestSprint = null;
      sprintImprovedAt = null;
    }
  } else if (prev.bestSprint === null || sprint >= prev.bestSprint) {
    bestSprint = sprint;
    if (prev.bestSprint === null) sprintImprovedAt = now;
  } else if (prev.sprintImprovedAt === null || now - prev.sprintImprovedAt >= IMPROVE_EVERY_MS) {
    bestSprint = sprint;
    sprintImprovedAt = now;
  }

  return { skills, levelStep, bestSprint, sprintImprovedAt, levelStepRaisedAt };
}

// --- Ranking ---

/** One opted-in player on a board. `testValue` is the value of a single test when ranking by one. */
export interface BoardEntry {
  userId: string;
  displayName: string;
  countryCode: string | null;
  city: string | null;
  hemisphere: Hemisphere | null;
  skills: number;
  levelStep: number;
  bestSprint: number | null;
  testValue?: number | null;
}

/** The viewer: where they are, whether or not they are on the board themselves. */
export interface Viewer {
  userId: string;
  countryCode: string | null;
  city: string | null;
  hemisphere: Hemisphere | null;
}

/** Whether a player is in the viewer's scope. A viewer without the needed detail sees nobody else. */
export function inScope(viewer: Viewer, entry: BoardEntry, scope: LeaderboardScope): boolean {
  if (entry.userId === viewer.userId) return true;
  switch (scope) {
    case "global":
      return true;
    case "continent": {
      const mine = continentOf(viewer.countryCode);
      return mine !== null && continentOf(entry.countryCode) === mine;
    }
    case "hemisphere": {
      const mine = hemisphereFor(viewer.countryCode, viewer.hemisphere);
      return mine !== null && hemisphereFor(entry.countryCode, entry.hemisphere) === mine;
    }
    case "country":
      return !!viewer.countryCode && entry.countryCode === viewer.countryCode;
    case "local": {
      const city = normalizeCity(viewer.city);
      return !!viewer.countryCode && city !== null && entry.countryCode === viewer.countryCode && normalizeCity(entry.city) === city;
    }
  }
}

/** Skills first (more is better), then level step (higher), then sprint (faster; no time ranks last). */
export function compareOverall(a: BoardEntry, b: BoardEntry): number {
  if (a.skills !== b.skills) return b.skills - a.skills;
  if (a.levelStep !== b.levelStep) return b.levelStep - a.levelStep;
  if (a.bestSprint === b.bestSprint) return 0;
  if (a.bestSprint === null) return 1;
  if (b.bestSprint === null) return -1;
  return a.bestSprint - b.bestSprint;
}

/** One test alone: the better value first, no value last. `better` is the direction the tree gives for that test. */
export function compareByTest(better: "lower" | "higher") {
  return (a: BoardEntry, b: BoardEntry): number => {
    const x = a.testValue ?? null;
    const y = b.testValue ?? null;
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return better === "lower" ? x - y : y - x;
  };
}

/**
 * Ranks the entries and gives each a rank. Entries that tie on every ranked field share a rank and the
 * next rank is skipped (1, 2, 2, 4), as in sport. Entries without a value in a single-test ranking are left out.
 */
export function rankEntries(
  entries: BoardEntry[],
  byTest?: { better: "lower" | "higher" },
): { entry: BoardEntry; rank: number }[] {
  const compare = byTest ? compareByTest(byTest.better) : compareOverall;
  const pool = byTest ? entries.filter((e) => e.testValue !== null && e.testValue !== undefined) : entries;
  const sorted = [...pool].sort((a, b) => compare(a, b) || a.userId.localeCompare(b.userId));
  const out: { entry: BoardEntry; rank: number }[] = [];
  sorted.forEach((entry, i) => {
    const rank = i > 0 && compare(sorted[i - 1], entry) === 0 ? out[i - 1].rank : i + 1;
    out.push({ entry, rank });
  });
  return out;
}

/**
 * The board a viewer sees: the top 50 in their scope, plus their own row when they are on the board but
 * further down. Only what other players may see is returned: no city, no user id.
 */
export function boardFor(
  entries: BoardEntry[],
  viewer: Viewer,
  scope: LeaderboardScope,
  options: { limit?: number; byTest?: { better: "lower" | "higher" } } = {},
): LeaderboardRow[] {
  const limit = options.limit ?? LEADERBOARD_LIMIT;
  const ranked = rankEntries(
    entries.filter((e) => inScope(viewer, e, scope)),
    options.byTest,
  );
  const shown = ranked.filter((r, i) => i < limit || r.entry.userId === viewer.userId);
  return shown.map(({ entry, rank }) => ({
    rank,
    displayName: entry.displayName,
    countryCode: entry.countryCode,
    skills: entry.skills,
    levelStep: entry.levelStep,
    bestSprint: entry.bestSprint,
    isMe: entry.userId === viewer.userId,
  }));
}
