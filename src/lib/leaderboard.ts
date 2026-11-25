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

// --- Display names ---

// A short English and Spanish list, checked here and in the database. It is a first line of defence,
// not a complete filter: a fluent reader should extend it before launch.
// Strong stems are blocked anywhere in the name ("xXfuckXx"). Short words are blocked only as a whole
// word, so "grape", "economy" and "computadora" stay fine. Known innocent words that hold a stem
// ("Scunthorpe", "snigger", "Yamashita") are taken out before the stem check; they are whole words, not
// fragments, so "snigga" is still caught. All lists are written folded (see foldWord).
export const BLOCKED_STEMS = ["fuck", "shit", "bitch", "cunt", "nigg", "whore", "hitler", "mierda", "pendejo", "cabron", "faggot"];
export const BLOCKED_WORDS = [
  "fag", "slut", "rape", "nazi", "puta", "puto", "joder", "coño", "verga", "pija", "violar",
  "culo", "marica", "maricon", "chinga",
];
// Whole words also count with a plural ending ("culos", "putas", "maricones"). Same as display_name_blocked
// in supabase/migrations/005_leaderboard.sql, which builds the same pattern from its blocked_words list.
const BLOCKED_WORD_PATTERN = new RegExp(`^(${BLOCKED_WORDS.join("|")})(s|es)?$`);
export const ALLOWED_WORDS = [
  "scunthorpe", "snigger", "sniggle", "niggle", "niggling", "niggard",
  "shitake", "yamashita", "matsushita", "kinoshita", "morishita", "mishit", "pushit",
];

// Cyrillic and Greek letters that look like Latin ones, character for character (same length). Upper case
// is listed too so the database gets it right even where its lower() only knows ASCII; here it is inert.
export const HOMOGLYPH_FROM = "авеёіїјкмнорстухѕһӏАВЕЁІЇЈКМНОРСТУХЅҺӀαβεηικνορτυχάέήίόύΑΒΕΗΙΚΝΟΡΤΥΧΆΈΉΊΌΎζΖ";
export const HOMOGLYPH_TO = "abeeiijkmhopctyxshlabeeiijkmhopctyxshlabenikvoptuxaeniouabehiknoptyxaehioyzz";
export const LOOKALIKE_FROM = "013457$@!";
export const LOOKALIKE_TO = "oieastsai";
// Only these accents are removed, the same list as the SQL function (other accents are left, then dropped as non-letters).
const ACCENTED = "áàäâéèëêíìïîóòöôúùüû";
const UNACCENTED = "aaaaeeeeiiiioooouuuu";

/** Like SQL translate(): each character in `from` becomes the one at the same place in `to`. */
function translateChars(text: string, from: string, to: string): string {
  const f = [...from];
  const t = [...to];
  return [...text].map((c) => {
    const i = f.indexOf(c);
    return i < 0 ? c : (t[i] ?? "");
  }).join("");
}

/** Lower case, Cyrillic/Greek and symbol look-alikes turned into Latin letters, listed accents off (ñ kept), everything else dropped. */
function foldWord(word: string): string {
  // Look-alikes before and after lower case, so capital Greek Ν reads as n (as in the database).
  const lower = translateChars(translateChars(word, HOMOGLYPH_FROM, HOMOGLYPH_TO).toLowerCase(), HOMOGLYPH_FROM, HOMOGLYPH_TO);
  return translateChars(translateChars(lower, LOOKALIKE_FROM, LOOKALIKE_TO), ACCENTED, UNACCENTED).replace(/[^a-zñ]/g, "");
}

/** Latin, Cyrillic and Greek letters, as regex classes. The database constraint uses the same ones. */
export const SCRIPT_CLASSES = ["[A-Za-z\u00C0-\u024F]", "[\u0400-\u04FF]", "[\u0370-\u03FF]"];

/** Letters from more than one of Latin, Cyrillic and Greek: the usual look-alike trick. Same ranges as the database. */
function mixesScripts(name: string): boolean {
  return SCRIPT_CLASSES.filter((c) => new RegExp(c).test(name)).length > 1;
}

function isBlockedName(name: string): boolean {
  const words = name.split(/[\s._-]+/).map(foldWord).filter(Boolean);
  const joined = words.join("");
  const withoutAllowed = ALLOWED_WORDS.reduce((s, ok) => s.split(ok).join(""), joined);
  if (BLOCKED_STEMS.some((stem) => withoutAllowed.includes(stem))) return true;
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
  if (mixesScripts(clean)) return "characters";
  if (isBlockedName(clean)) return "blocked";
  return null;
}

// --- Cheating limits ---

/**
 * What the database keeps per player and tree. Times are when the value last changed.
 * `bestSprint` is shown and ranked, and is cleared when the player clears their 30 m results.
 * `sprintRecord` is the fastest time ever accepted and is never cleared, so clearing results can't
 * reset the once-per-24-hours limit on getting faster.
 */
export interface ScoreSnapshot {
  skills: number;
  levelStep: number;
  bestSprint: number | null;
  sprintRecord: number | null;
  sprintImprovedAt: number | null;
  levelStepRaisedAt: number | null;
}

/** What the player's progress says now. */
export interface ScoreInput {
  /** Finished skills, counted with countRankedSkills(). */
  skills: number;
  levelStep: number;
  /** Every 30 m time in the player's results, possible or not. Empty means no 30 m results at all. */
  sprintTimes: number[];
}

/**
 * How many finished skills count towards the score: distinct ids that are real skills of the tree.
 * `done` is written by the browser, so duplicates or made-up ids must add nothing.
 */
export function countRankedSkills(done: readonly string[], skillIds: readonly string[]): number {
  const real = new Set(skillIds);
  return new Set(done.filter((id) => real.has(id))).size;
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
 * The stored score after the player's progress changed, with the cheating limits applied. The database
 * trigger in migration 005 follows the same steps one for one.
 * - The first save is taken as it is, but starts both 24-hour timers (when it has a level step or a sprint).
 * - The level step can always go down; it can rise by 1, once per 24 hours.
 * - Sprint (impossible times, under 3.6 s or over 15 s, are ignored):
 *   - no 30 m results at all: the best is cleared (off the sprint board); the record and timer are kept;
 *   - only impossible times: nothing changes;
 *   - no record yet, or faster than the record with 24 hours since the last improvement: a new record;
 *   - as fast as the record or slower: taken as it is;
 *   - faster than the record too soon: the previous best stays, or the record if the best was cleared.
 */
export function applyScoreUpdate(prev: ScoreSnapshot | null, input: ScoreInput, now: number): ScoreSnapshot {
  const skills = Math.max(0, Math.floor(input.skills));
  const wanted = Math.max(0, Math.min(16, Math.floor(input.levelStep)));
  const hasSprint = input.sprintTimes.length > 0;
  const sprint = bestPossibleSprint(input.sprintTimes);

  if (!prev) {
    return {
      skills,
      levelStep: wanted,
      levelStepRaisedAt: wanted > 0 ? now : null,
      bestSprint: sprint,
      sprintRecord: sprint,
      sprintImprovedAt: sprint === null ? null : now,
    };
  }

  let { levelStep, levelStepRaisedAt } = prev;
  if (wanted <= prev.levelStep) {
    levelStep = wanted;
  } else if (prev.levelStepRaisedAt === null || now - prev.levelStepRaisedAt >= IMPROVE_EVERY_MS) {
    levelStep = prev.levelStep + 1;
    levelStepRaisedAt = now;
  }

  let { bestSprint, sprintRecord, sprintImprovedAt } = prev;
  if (!hasSprint) {
    bestSprint = null;
  } else if (sprint === null) {
    // Only impossible times: nothing changes.
  } else if (
    prev.sprintRecord === null ||
    (sprint < prev.sprintRecord && (prev.sprintImprovedAt === null || now - prev.sprintImprovedAt >= IMPROVE_EVERY_MS))
  ) {
    bestSprint = sprint;
    sprintRecord = sprint;
    sprintImprovedAt = now;
  } else if (sprint >= prev.sprintRecord) {
    bestSprint = sprint;
  } else {
    bestSprint = prev.bestSprint ?? prev.sprintRecord;
  }

  return { skills, levelStep, levelStepRaisedAt, bestSprint, sprintRecord, sprintImprovedAt };
}

// --- Ranking ---

/** One opted-in player on a board. `testValue` is the value of a single test when ranking by one. */
export interface BoardEntry {
  userId: string;
  displayName: string;
  countryCode: string | null;
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
 * further down. Only what other players may see is returned: no user id.
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
