import { countryByCode } from "../data/countries";
import type { Continent, Hemisphere, LeaderboardRow, LeaderboardScope } from "../types";

// The leaderboard's rules (#96), written once in TypeScript. The database does the real ranking and
// enforces the same rules in migration 005 (supabase/migrations/005_leaderboard.sql); these functions
// are the reference the tests hold both to, and what the app uses to check input before sending it.
//
// Players are ranked by a tuple, not a weighted sum: skills finished first, then level step, then the
// best 30 m sprint (lower is better, no time ranks last). Skills come first because players pick their
// own level, so level alone would let anyone claim the top by choosing Expert.

/** The last rank a board shows. Everyone tied at this rank is shown too, then the viewer's own row. */
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
// not a complete filter: a fluent reader should extend it before launch, and reports catch the rest.
// Each word of a name is checked on its own, so "Mac Untermann" and "Josh Italia" stay fine; runs of
// one- and two-letter words are joined first, so "p u t a" and "f.u.c.k" are still caught.
// Strong stems are blocked anywhere in a word ("xXfuckXx"). Short words are blocked only as a whole word,
// so "grape", "economy" and "computadora" stay fine, but digits and a plural "s" or "es" don't hide them
// ("Puta10", "Nazis"). Every check also runs with repeated letters squeezed ("fuuck"). A word that is a
// known innocent word ("Scunthorpe", "Yamashita", "Putto", a painted cherub) is let through: compared with
// digits dropped (so "Pu7to" is not "putto"), squeezed or not ("Shiitake"), plural "s" or "es" allowed.
// Only the whole word counts, so "Sniggle" and "Niggler" are still caught although they hold "niggle".
// All lists are written folded (see foldLetters).
export const BLOCKED_STEMS = ["fuck", "shit", "bitch", "cunt", "nigg", "whore", "hitler", "mierda", "pendejo", "cabron", "faggot"];
export const BLOCKED_WORDS = ["fag", "slut", "rape", "nazi", "puta", "puto", "joder", "coño", "verga", "pija", "violar", "culo", "marica", "maricon", "chinga"];
export const ALLOWED_WORDS = [
  "scunthorpe", "niggle", "niggling", "niggemann",
  "shitake", "yamashita", "matsushita", "kinoshita", "morishita", "ishita", "kshitij", "yoshitaka", "mishit", "pushit", "pushitup",
  "putto", "rappe",
];

// Cyrillic and Greek letters that look like Latin ones, character for character (same length), and the
// Turkish dotless ı. Upper case is listed too so the database gets it right even where its lower() only
// knows ASCII; here it is inert.
export const HOMOGLYPH_FROM = "авеёіїјкмнорстухѕһӏАВЕЁІЇЈКМНОРСТУХЅҺӀαβεηικνορτυχάέήίόύΑΒΕΗΙΚΝΟΡΤΥΧΆΈΉΊΌΎζΖı";
export const HOMOGLYPH_TO = "abeeiijkmhopctyxshlabeeiijkmhopctyxshlabenikvoptuxaeniouabehiknoptyxaehioyzzi";
export const LOOKALIKE_FROM = "013457";
export const LOOKALIKE_TO = "oieast";

/**
 * The letters a name may use, after NFKC: Latin (A-Z, Latin-1, Extended-A and -B, and Extended Additional
 * for Vietnamese) without × and ÷, Greek and Cyrillic without the signs and combining marks in their
 * blocks. Anything else is refused, so small capitals ("ꜰᴜᴄᴋ"), other scripts, emoji and stray accents
 * can't be used to dodge the list. Written as explicit ranges, the same in the database.
 */
export const NAME_LETTERS =
  "A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03CE\u0400-\u0481\u048A-\u04FF";

/** A letter or digit first, then letters, digits 0-9, spaces, dots, dashes and underscores. No "@", so no email addresses. */
export const NAME_PATTERN = `^[0-9${NAME_LETTERS}][0-9${NAME_LETTERS} ._-]*$`;

/** Latin, Cyrillic and Greek letters, as regex classes. The database constraint uses the same ones. */
export const SCRIPT_CLASSES = ["[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]", "[\u0400-\u04FF]", "[\u0370-\u03FF]"];

/** Like SQL translate(): each character in `from` becomes the one at the same place in `to`. */
function translateChars(text: string, from: string, to: string): string {
  const f = [...from];
  const t = [...to];
  return [...text].map((c) => {
    const i = f.indexOf(c);
    return i < 0 ? c : (t[i] ?? "");
  }).join("");
}

/**
 * The name as it is stored: NFKC, so fullwidth "ｆｕｃｋ", maths letters "𝐟𝐮𝐜𝐤" and the long s in "ſhit" become
 * plain letters, and spaces trimmed from both ends. The database trigger does the same; send this.
 */
export function normalizeDisplayName(name: string): string {
  return name.normalize("NFKC").replace(/^ +| +$/g, "");
}

/**
 * What must be unique: lower case with Cyrillic and Greek look-alikes turned into Latin letters, so an
 * all-Cyrillic "Сосо" can't stand in for "Coco". Same as public.display_name_key() in the database.
 */
export function displayNameKey(name: string): string {
  // Look-alikes before and after lower case, so capital Greek Ν reads as n (as in the database).
  return translateChars(translateChars(name, HOMOGLYPH_FROM, HOMOGLYPH_TO).toLowerCase(), HOMOGLYPH_FROM, HOMOGLYPH_TO);
}

/** A word in lower case, look-alikes turned into Latin letters, accents off (but ñ kept). Digits and the rest are left in. */
function foldLetters(word: string): string {
  const lower = displayNameKey(word).replace(/[ñÑ]/g, "n~");
  return lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/n~/g, "ñ");
}

/** Repeated letters squeezed to one: "fuuck" to "fuck". */
function squeeze(word: string): string {
  return word.replace(/(.)\1+/gu, "$1");
}

/**
 * The words to check, each folded two ways: `mapped` turns look-alike digits into letters ("sh1t" to "shit"),
 * `bare` drops digits ("Puta10" to "puta"). Runs of one- and two-letter words are joined into one.
 */
function nameWords(name: string): { mapped: string; bare: string }[] {
  const words: { mapped: string; bare: string }[] = [];
  let run = { mapped: "", bare: "" };
  for (const raw of name.split(/[\s._-]+/)) {
    const letters = foldLetters(raw);
    const mapped = translateChars(letters, LOOKALIKE_FROM, LOOKALIKE_TO).replace(/[^a-zñ]/g, "");
    const bare = letters.replace(/[^a-zñ]/g, "");
    if (!mapped) continue;
    if ([...mapped].length <= 2) {
      run = { mapped: run.mapped + mapped, bare: run.bare + bare };
      continue;
    }
    if (run.mapped) words.push(run);
    run = { mapped: "", bare: "" };
    words.push({ mapped, bare });
  }
  if (run.mapped) words.push(run);
  return words;
}

function isBlockedName(name: string): boolean {
  return nameWords(normalizeDisplayName(name)).some(({ mapped, bare }) => {
    const forms = [mapped, squeeze(mapped), bare, squeeze(bare)];
    const endings = (form: string) => [form, form.replace(/s$/, ""), form.replace(/es$/, "")];
    if ([bare, squeeze(bare)].some((form) => endings(form).some((w) => ALLOWED_WORDS.includes(w)))) return false;
    if (forms.some((form) => BLOCKED_STEMS.some((stem) => form.includes(stem)))) return true;
    return forms.some((form) => endings(form).some((w) => BLOCKED_WORDS.includes(w)));
  });
}

/** Letters from more than one of Latin, Cyrillic and Greek: the usual look-alike trick. Same ranges as the database. */
function mixesScripts(name: string): boolean {
  return SCRIPT_CLASSES.filter((c) => new RegExp(c, "u").test(name)).length > 1;
}

/** Null if the name is fine, otherwise a short reason code the screen can translate. Checks the name as it will be stored (see normalizeDisplayName). */
export function displayNameError(name: string): "too-short" | "too-long" | "characters" | "blocked" | null {
  const clean = normalizeDisplayName(name);
  const length = [...clean].length; // code points, as the database's char_length counts them
  if (length < NAME_MIN) return "too-short";
  if (length > NAME_MAX) return "too-long";
  if (!new RegExp(NAME_PATTERN, "u").test(clean)) return "characters";
  if (mixesScripts(clean)) return "characters";
  if (isBlockedName(clean)) return "blocked";
  return null;
}

// --- Cheating limits ---

/** The stored skills count can rise by at most this much per 24 hours (and on the first save). */
export const SKILLS_PER_DAY = 3;

/** The first sprint time a player saves counts as no faster than this (seconds). */
export const FIRST_SPRINT_FLOOR = 4.5;

/** An accepted faster sprint is at most this fraction of the record (5% faster), rounded to 0.01 s. */
export const SPRINT_STEP = 0.95;

/**
 * What the database keeps per player and tree. Times are when the value last rose (or got faster).
 * `bestSprint` is shown and ranked, and is cleared when the player clears their 30 m results.
 * `sprintRecord` is the fastest time ever accepted and is never cleared, so clearing results can't
 * reset the once-per-24-hours limit on getting faster. Opting out of the leaderboard only hides the
 * row; the snapshot and its timers are kept, so opting out and back in resets nothing.
 */
export interface ScoreSnapshot {
  skills: number;
  levelStep: number;
  bestSprint: number | null;
  sprintRecord: number | null;
  sprintImprovedAt: number | null;
  levelStepRaisedAt: number | null;
  skillsRaisedAt: number | null;
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

/**
 * Rounds a time to 0.01 s, half up, like the database's round(x, 2) on numeric. Plain
 * Math.round(x * 100) / 100 gets some halves wrong (4.005 * 100 is 400.49999...), so the float noise is
 * trimmed first. Only for positive times; the tests check it against exact decimal rounding.
 */
export function roundSprint(seconds: number): number {
  return Math.round(Number((seconds * 100).toPrecision(12))) / 100;
}

/**
 * The fastest possible time in a list of 30 m results, rounded to 0.01 s, or null. Impossible times can't
 * hide a real one. The range is checked on the raw time, then the fastest is rounded, so 4.996 counts as
 * 5.00 and is not faster than a 5.00 record.
 */
export function bestPossibleSprint(times: number[]): number | null {
  const possible = times.filter(sprintIsPossible);
  return possible.length ? roundSprint(Math.min(...possible)) : null;
}

/**
 * The stored score after the player's progress changed, with the cheating limits applied. The database
 * trigger in migration 005 follows the same steps one for one.
 * - First save (no stored score yet): skills at most SKILLS_PER_DAY (3), level step at most 1, and a sprint
 *   no faster than FIRST_SPRINT_FLOOR (4.5 s). Each 24-hour timer starts when its value is above zero or set.
 * - Skills can always go down (the timer is left alone); they can rise by at most 3, once per 24 hours.
 *   One timer: a raise of 1 uses up the day, so a second skill finished later that day counts the next day.
 * - The level step can always go down; it can rise by 1, once per 24 hours.
 * - Sprint (impossible times, under 3.6 s or over 15 s, are ignored; the fastest is rounded to 0.01 s):
 *   - no 30 m results at all: the best is cleared (off the sprint board); the record and timer are kept;
 *   - only impossible times: nothing changes;
 *   - no record yet: the time, but no faster than 4.5 s, becomes the record;
 *   - faster than the record with 24 hours since the last improvement: a new record, but at most 5% faster
 *     (no faster than the record times SPRINT_STEP, rounded to 0.01 s);
 *   - as fast as the record or slower: taken as it is;
 *   - faster than the record too soon: the previous best stays, or the record if the best was cleared.
 */
export function applyScoreUpdate(prev: ScoreSnapshot | null, input: ScoreInput, now: number): ScoreSnapshot {
  const skillCount = Math.max(0, Math.floor(input.skills));
  const wanted = Math.max(0, Math.min(16, Math.floor(input.levelStep)));
  const hasSprint = input.sprintTimes.length > 0;
  const sprint = bestPossibleSprint(input.sprintTimes);

  if (!prev) {
    const skills = Math.min(skillCount, SKILLS_PER_DAY);
    const levelStep = Math.min(wanted, 1);
    const first = sprint === null ? null : Math.max(sprint, FIRST_SPRINT_FLOOR);
    return {
      skills,
      skillsRaisedAt: skills > 0 ? now : null,
      levelStep,
      levelStepRaisedAt: levelStep > 0 ? now : null,
      bestSprint: first,
      sprintRecord: first,
      sprintImprovedAt: first === null ? null : now,
    };
  }

  let { skills, skillsRaisedAt } = prev;
  if (skillCount <= prev.skills) {
    skills = skillCount;
  } else if (prev.skillsRaisedAt === null || now - prev.skillsRaisedAt >= IMPROVE_EVERY_MS) {
    skills = Math.min(skillCount, prev.skills + SKILLS_PER_DAY);
    skillsRaisedAt = now;
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
  } else if (prev.sprintRecord === null) {
    bestSprint = Math.max(sprint, FIRST_SPRINT_FLOOR);
    sprintRecord = bestSprint;
    sprintImprovedAt = now;
  } else if (
    sprint < prev.sprintRecord &&
    (prev.sprintImprovedAt === null || now - prev.sprintImprovedAt >= IMPROVE_EVERY_MS)
  ) {
    bestSprint = Math.max(sprint, roundSprint(prev.sprintRecord * SPRINT_STEP));
    sprintRecord = bestSprint;
    sprintImprovedAt = now;
  } else if (sprint >= prev.sprintRecord) {
    bestSprint = sprint;
  } else {
    bestSprint = prev.bestSprint ?? prev.sprintRecord;
  }

  return { skills, skillsRaisedAt, levelStep, levelStepRaisedAt, bestSprint, sprintRecord, sprintImprovedAt };
}

// --- Ranking ---

/** One opted-in player on a board. `testValue` is the value of a single test when ranking by one. */
export interface BoardEntry {
  userId: string;
  /** The random key the database gives the row instead of the user id (leaderboard_keys), for reports. */
  rowKey: string;
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
 * Plain Unicode code-point order, like the database's `collate "C"` (UTF-8 bytes sort in code-point
 * order). Not localeCompare, which follows the browser's language, and not `<`, which compares UTF-16 units.
 */
export function compareCodePoints(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

/**
 * Ranks the entries and gives each a rank. Entries that tie on every ranked field share a rank and the
 * next rank is skipped (1, 2, 2, 4), as in sport. Ties are listed by display name in code-point order,
 * as the database does. Entries without a value in a single-test ranking are left out.
 */
export function rankEntries(
  entries: BoardEntry[],
  byTest?: { better: "lower" | "higher" },
): { entry: BoardEntry; rank: number }[] {
  const compare = byTest ? compareByTest(byTest.better) : compareOverall;
  const pool = byTest ? entries.filter((e) => e.testValue !== null && e.testValue !== undefined) : entries;
  // Names are unique in the database; the user id only settles test data that repeats a name.
  const sorted = [...pool].sort(
    (a, b) => compare(a, b) || compareCodePoints(a.displayName, b.displayName) || compareCodePoints(a.userId, b.userId),
  );
  const out: { entry: BoardEntry; rank: number }[] = [];
  sorted.forEach((entry, i) => {
    const rank = i > 0 && compare(sorted[i - 1], entry) === 0 ? out[i - 1].rank : i + 1;
    out.push({ entry, rank });
  });
  return out;
}

/**
 * The board a viewer sees: everyone ranked 50 or better in their scope (so all players tied at 50 are
 * shown, as in the database), plus their own row when they are on the board but further down. Only what
 * other players may see is returned: no user id, only the row key for reports.
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
  const shown = ranked.filter((r) => r.rank <= limit || r.entry.userId === viewer.userId);
  return shown.map(({ entry, rank }) => ({
    rank,
    rowKey: entry.rowKey,
    displayName: entry.displayName,
    countryCode: entry.countryCode,
    skills: entry.skills,
    levelStep: entry.levelStep,
    bestSprint: entry.bestSprint,
    isMe: entry.userId === viewer.userId,
  }));
}
