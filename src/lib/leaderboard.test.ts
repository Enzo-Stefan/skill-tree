import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import {
  ALLOWED_WORDS,
  BLOCKED_STEMS,
  BLOCKED_WORDS,
  HOMOGLYPH_FROM,
  HOMOGLYPH_TO,
  LOOKALIKE_FROM,
  LOOKALIKE_TO,
  NAME_PATTERN,
  SCRIPT_CLASSES,
  IMPROVE_EVERY_MS,
  FIRST_SPRINT_FLOOR,
  SKILLS_PER_DAY,
  SPRINT_STEP,
  roundSprint,
  applyScoreUpdate,
  bestPossibleSprint,
  countRankedSkills,
  boardFor,
  compareCodePoints,
  displayNameError,
  displayNameKey,
  inScope,
  levelStepOf,
  normalizeDisplayName,
  rankEntries,
  type BoardEntry,
  type ScoreSnapshot,
  type Viewer,
} from "./leaderboard";

const entry = (userId: string, over: Partial<BoardEntry> = {}): BoardEntry => ({
  userId,
  rowKey: `key-${userId}`,
  displayName: userId,
  countryCode: "AL",
  hemisphere: null,
  skills: 10,
  levelStep: 5,
  bestSprint: 5,
  ...over,
});

const viewer = (over: Partial<Viewer> = {}): Viewer => ({ userId: "me", countryCode: "AL", hemisphere: null, ...over });

describe("level step", () => {
  const levels = ["beginner", "intermediate", "advanced", "expert"];
  it("is level times 4 plus the step, 1 to 16", () => {
    expect(levelStepOf(levels, "beginner", 1)).toBe(1);
    expect(levelStepOf(levels, "intermediate", 1)).toBe(5);
    expect(levelStepOf(levels, "expert", 4)).toBe(16);
  });
  it("is 0 without a level, and keeps the step in range", () => {
    expect(levelStepOf(levels, null, 3)).toBe(0);
    expect(levelStepOf(levels, "advanced", 9)).toBe(12);
  });
});

describe("ranking", () => {
  it("ranks skills first, then level step, then sprint with no time last", () => {
    const rows = rankEntries([
      entry("fast", { skills: 10, levelStep: 5, bestSprint: 4.5 }),
      entry("slow", { skills: 10, levelStep: 5, bestSprint: 6 }),
      entry("none", { skills: 10, levelStep: 5, bestSprint: null }),
      entry("higher-step", { skills: 10, levelStep: 9 }),
      entry("most-skills", { skills: 20, levelStep: 1, bestSprint: null }),
    ]);
    expect(rows.map((r) => r.entry.userId)).toEqual(["most-skills", "higher-step", "fast", "slow", "none"]);
  });

  it("stops a self-picked Expert level from beating more skills", () => {
    const rows = rankEntries([entry("claimer", { skills: 1, levelStep: 16 }), entry("worker", { skills: 12, levelStep: 2 })]);
    expect(rows[0].entry.userId).toBe("worker");
  });

  it("gives ties the same rank and skips the next (1, 2, 2, 4)", () => {
    const rows = rankEntries([
      entry("a", { skills: 9 }),
      entry("b", { skills: 8 }),
      entry("c", { skills: 8 }),
      entry("d", { skills: 7 }),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("lists ties by display name in code-point order, like the database's collate \"C\"", () => {
    const tied = [entry("u1", { displayName: "zed" }), entry("u2", { displayName: "Bob" }), entry("u3", { displayName: "alice" }), entry("u0", { displayName: "Émile" })];
    const a = rankEntries(tied).map((r) => r.entry.displayName);
    const b = rankEntries([...tied].reverse()).map((r) => r.entry.displayName);
    // Upper case before lower case, accented letters after both: plain code points, not the browser's language.
    expect(a).toEqual(["Bob", "alice", "zed", "Émile"]);
    expect(b).toEqual(a);
    expect(rankEntries(tied).map((r) => r.rank)).toEqual([1, 1, 1, 1]);
  });

  it("compares code points, not UTF-16 units", () => {
    expect(compareCodePoints("a", "b")).toBeLessThan(0);
    expect(compareCodePoints("ab", "a")).toBeGreaterThan(0);
    expect(compareCodePoints("Z", "a")).toBeLessThan(0);
    // U+FF21 (one UTF-16 unit) sorts before U+1D400 (a surrogate pair), though "<" says the opposite.
    expect("\u{FF21}" < "\u{1D400}").toBe(false);
    expect(compareCodePoints("\u{FF21}", "\u{1D400}")).toBeLessThan(0);
  });

  it("ranks one test alone in the direction given, leaving out players without a value", () => {
    const entries = [
      entry("a", { testValue: 5.2 }),
      entry("b", { testValue: 4.8 }),
      entry("c", { testValue: null }),
      entry("d", { testValue: 4.8 }),
    ];
    const lower = rankEntries(entries, { better: "lower" });
    expect(lower.map((r) => [r.entry.userId, r.rank])).toEqual([["b", 1], ["d", 1], ["a", 3]]);
    const higher = rankEntries(entries, { better: "higher" });
    expect(higher[0].entry.userId).toBe("a");
  });
});

describe("scopes", () => {
  const me = viewer({ countryCode: "AL" });
  const tirana = entry("t", { countryCode: "AL" });
  const durres = entry("d", { countryCode: "AL" });
  const italy = entry("i", { countryCode: "IT" });
  const brazil = entry("br", { countryCode: "BR", hemisphere: "S" });
  const argentina = entry("ar", { countryCode: "AR" });

  it("global includes everyone", () => {
    for (const e of [tirana, durres, italy, brazil]) expect(inScope(me, e, "global")).toBe(true);
  });

  it("country is the same country only", () => {
    expect(inScope(me, durres, "country")).toBe(true);
    expect(inScope(me, italy, "country")).toBe(false);
  });

  it("continent is the same continent, from the country table", () => {
    expect(inScope(me, italy, "continent")).toBe(true);
    expect(inScope(me, brazil, "continent")).toBe(false);
  });

  it("hemisphere uses the capital, or the pick for countries that cross the equator", () => {
    expect(inScope(me, italy, "hemisphere")).toBe(true);
    expect(inScope(me, argentina, "hemisphere")).toBe(false);
    expect(inScope(me, brazil, "hemisphere")).toBe(false);
    const southBrazil = viewer({ countryCode: "BR", hemisphere: "S" });
    expect(inScope(southBrazil, argentina, "hemisphere")).toBe(true);
    expect(inScope(southBrazil, brazil, "hemisphere")).toBe(true);
    expect(inScope(southBrazil, italy, "hemisphere")).toBe(false);
  });

  it("a viewer without the needed detail sees nobody else, only themselves", () => {
    const nobody = viewer({ countryCode: null });
    for (const scope of ["continent", "hemisphere", "country"] as const) {
      expect(inScope(nobody, italy, scope), scope).toBe(false);
      expect(inScope(nobody, entry("me"), scope), scope).toBe(true);
    }
    const unpicked = viewer({ countryCode: "BR", hemisphere: null });
    expect(inScope(unpicked, brazil, "hemisphere")).toBe(false);
  });
});

describe("the board a viewer sees", () => {
  const many = Array.from({ length: 60 }, (_, i) => entry(`p${String(i).padStart(2, "0")}`, { skills: 100 - i }));

  it("returns the top 50", () => {
    const rows = boardFor(many, viewer({ userId: "p00" }), "global");
    expect(rows).toHaveLength(50);
    expect(rows[0].rank).toBe(1);
    expect(rows.at(-1)!.rank).toBe(50);
  });

  it("adds the viewer's own row when they are further down, with their true rank", () => {
    const rows = boardFor(many, viewer({ userId: "p57" }), "global");
    expect(rows).toHaveLength(51);
    expect(rows.at(-1)).toMatchObject({ rank: 58, displayName: "p57", isMe: true });
    expect(rows.filter((r) => r.isMe)).toHaveLength(1);
  });

  it("does not add a viewer who is not on the board", () => {
    expect(boardFor(many, viewer({ userId: "stranger" }), "global")).toHaveLength(50);
  });

  it("shows everyone tied at rank 50, as the database does (rank <= 50)", () => {
    // 49 clear places, then five players tied at rank 50, then one below.
    const top = Array.from({ length: 49 }, (_, i) => entry(`p${String(i).padStart(2, "0")}`, { skills: 100 - i }));
    const tied = ["t4", "t2", "t0", "t3", "t1"].map((id) => entry(id, { skills: 20 }));
    const rows = boardFor([...top, ...tied, entry("last", { skills: 1 })], viewer({ userId: "stranger" }), "global");
    expect(rows).toHaveLength(54);
    expect(rows.slice(49).map((r) => [r.displayName, r.rank])).toEqual([["t0", 50], ["t1", 50], ["t2", 50], ["t3", 50], ["t4", 50]]);
    expect(rows.some((r) => r.displayName === "last")).toBe(false);
  });

  it("ranks inside the scope, so the same player has a different rank in their country", () => {
    const entries = [entry("a", { skills: 30, countryCode: "IT" }), entry("me", { skills: 20, countryCode: "AL" }), entry("b", { skills: 10, countryCode: "AL" })];
    expect(boardFor(entries, viewer(), "global").find((r) => r.isMe)!.rank).toBe(2);
    expect(boardFor(entries, viewer(), "country").find((r) => r.isMe)!.rank).toBe(1);
  });

  it("never returns the user id, only the row key", () => {
    const rows = boardFor([entry("user-123", { displayName: "Me", rowKey: "f1e2d3" })], viewer({ userId: "user-123" }), "global");
    expect(Object.keys(rows[0]).sort()).toEqual(["bestSprint", "countryCode", "displayName", "isMe", "levelStep", "rank", "rowKey", "skills"]);
    expect(rows[0]).toMatchObject({ rowKey: "f1e2d3", isMe: true });
    expect(Object.values(rows[0])).not.toContain("user-123");
  });

  it("ranks by one test alone when asked", () => {
    const entries = [entry("me", { testValue: 6 }), entry("a", { testValue: 5 }), entry("b", { testValue: null })];
    const rows = boardFor(entries, viewer(), "global", { byTest: { better: "lower" } });
    expect(rows.map((r) => [r.displayName, r.rank])).toEqual([["a", 1], ["me", 2]]);
  });
});

describe("display names", () => {
  // Shared with the database check: scripts that load migration 005 run the same names through it.
  const cases: { name: string; expected: string; note?: string }[] = JSON.parse(
    readFileSync(new URL("./displayNameCases.json", import.meta.url), "utf8"),
  );

  it("judges every shared case as expected", () => {
    expect(cases.length).toBeGreaterThan(50);
    for (const { name, expected, note } of cases) {
      expect(displayNameError(name) ?? "ok", `${JSON.stringify(name)} ${note ?? ""}`).toBe(expected);
    }
  });

  it("stores names NFKC-normalised with spaces trimmed", () => {
    const fullwidth = [..."Stefan"].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join("");
    expect(normalizeDisplayName(`  ${fullwidth}  `)).toBe("Stefan");
    expect(normalizeDisplayName("Ana  María ")).toBe("Ana  María");
  });

  it("counts the length in characters, not UTF-16 units, as the database does", () => {
    // One letter and one emoji: 2 characters (too short), though 3 UTF-16 units.
    expect(displayNameError(`a${String.fromCodePoint(0x1f600)}`)).toBe("too-short");
  });

  it("keys names by lower case and look-alike letters, so an all-Cyrillic Coco clashes with the Latin one", () => {
    const cyrillicCoco = String.fromCharCode(0x421, 0x43e, 0x441, 0x43e);
    expect(displayNameKey(cyrillicCoco)).toBe("coco");
    expect(displayNameKey("COCO")).toBe("coco");
    expect(displayNameKey("Coca")).not.toBe(displayNameKey("Coco"));
    expect(displayNameKey("Leo_10")).toBe("leo_10");
  });
});

describe("the database name check matches this one", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/005_leaderboard.sql", import.meta.url), "utf8");
  const fn = (name: string) => {
    const start = sql.indexOf(`function public.${name}(`);
    return start < 0 ? "" : sql.slice(start, sql.indexOf("$$;", start));
  };
  const sqlArray = (name: string) => {
    const m = fn("display_name_blocked").match(new RegExp(`${name}\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
  };
  const sqlText = (where: string, name: string) => fn(where).match(new RegExp(`${name}\\s+text\\s*:=\\s*'([^']*)'`))?.[1] ?? null;

  it("has the same blocked stems, blocked words and allowed words", () => {
    expect(sqlArray("blocked_stems")).toEqual(BLOCKED_STEMS);
    expect(sqlArray("blocked_words")).toEqual(BLOCKED_WORDS);
    expect(sqlArray("allowed_words")).toEqual(ALLOWED_WORDS);
  });

  it("has the same look-alike maps, each pair the same length so nothing is silently dropped", () => {
    expect(sqlText("display_name_key", "homoglyph_from")).toBe(HOMOGLYPH_FROM);
    expect(sqlText("display_name_key", "homoglyph_to")).toBe(HOMOGLYPH_TO);
    expect(sqlText("display_name_blocked", "lookalike_from")).toBe(LOOKALIKE_FROM);
    expect(sqlText("display_name_blocked", "lookalike_to")).toBe(LOOKALIKE_TO);
    expect([...HOMOGLYPH_FROM]).toHaveLength([...HOMOGLYPH_TO].length);
    expect([...LOOKALIKE_FROM]).toHaveLength([...LOOKALIKE_TO].length);
    expect(new Set(HOMOGLYPH_FROM).size).toBe([...HOMOGLYPH_FROM].length);
  });

  it("refuses the same characters and the same mix of alphabets", () => {
    const inSql = [...fn("display_name_chars_ok").matchAll(/~ '([^']+)'/g)].map((m) => m[1]);
    expect(inSql).toEqual([NAME_PATTERN, ...SCRIPT_CLASSES]);
  });

  it("stores the name normalised and trimmed, and keeps it unique by the same key", () => {
    expect(fn("check_display_name")).toContain("new.display_name := btrim(normalize(new.display_name, NFKC), ' ');");
    expect(fn("display_name_blocked")).toContain("normalize(name, NFKC)");
    expect(sql).toMatch(/create unique index if not exists \w+ on public\.profiles \(public\.display_name_key\(display_name\)\)/);
  });
});

describe("cheating limits", () => {
  const DAY = IMPROVE_EVERY_MS;
  const start = Date.parse("2026-11-24T10:00:00Z");
  const base: ScoreSnapshot = {
    skills: 5, levelStep: 3, bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start, levelStepRaisedAt: start, skillsRaisedAt: start,
  };

  it("picks the fastest possible sprint, so an impossible time can't hide a real one", () => {
    expect(bestPossibleSprint([2.1, 5.4, 4.9, 20])).toBe(4.9);
    expect(bestPossibleSprint([2.1, 20])).toBeNull();
    expect(bestPossibleSprint([])).toBeNull();
  });

  it("caps a first save: skills at most 3, level step at most 1, sprint no faster than 4.5 s", () => {
    expect(applyScoreUpdate(null, { skills: 32, levelStep: 16, sprintTimes: [3.6] }, start)).toEqual({
      skills: SKILLS_PER_DAY, skillsRaisedAt: start, levelStep: 1, levelStepRaisedAt: start,
      bestSprint: FIRST_SPRINT_FLOOR, sprintRecord: FIRST_SPRINT_FLOOR, sprintImprovedAt: start,
    });
    // Under the caps, the first save is taken as it is.
    expect(applyScoreUpdate(null, { skills: 2, levelStep: 1, sprintTimes: [6.2] }, start)).toMatchObject({ skills: 2, levelStep: 1, bestSprint: 6.2, sprintRecord: 6.2 });
  });

  it("ignores an impossible first sprint", () => {
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, sprintTimes: [3.5] }, start).bestSprint).toBeNull();
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, sprintTimes: [15.1] }, start).bestSprint).toBeNull();
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, sprintTimes: [15] }, start).bestSprint).toBe(15);
  });

  it("ignores an impossible sprint later on and keeps the old one", () => {
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [2] }, start + 5 * DAY).bestSprint).toBe(5);
  });

  it("lets the best sprint get faster once per 24 hours", () => {
    const tooSoon = applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.8] }, start + DAY - 1);
    expect(tooSoon.bestSprint).toBe(5);
    const later = applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.8] }, start + DAY);
    expect(later).toMatchObject({ bestSprint: 4.8, sprintRecord: 4.8, sprintImprovedAt: start + DAY });
  });

  it("lets an accepted sprint be at most 5% faster than the record", () => {
    // 5.00 * 0.95 = 4.75: a 3.9 is stored as 4.75, and the next day can go 5% further (4.5125 -> 4.51).
    const day1 = applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [3.9] }, start + DAY);
    expect(day1).toMatchObject({ bestSprint: 4.75, sprintRecord: 4.75, sprintImprovedAt: start + DAY });
    const day2 = applyScoreUpdate(day1, { skills: 5, levelStep: 3, sprintTimes: [3.9] }, start + 2 * DAY);
    expect(day2).toMatchObject({ bestSprint: 4.51, sprintRecord: 4.51 });
    // Exactly 5% faster is taken as it is.
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.75] }, start + DAY).bestSprint).toBe(4.75);
  });

  it("rounds the fastest time to 0.01 s before comparing, so 4.996 is not faster than 5.00", () => {
    expect(bestPossibleSprint([4.996, 5.2])).toBe(5);
    // After 24 hours a real improvement would move the timer; 4.996 must not.
    const later = applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.996] }, start + DAY);
    expect(later).toMatchObject({ bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start });
    // A slower best with a 5.00 record: 4.996 too soon is "as fast as the record", so it is taken as 5.
    const slower = { ...base, bestSprint: 6 };
    expect(applyScoreUpdate(slower, { skills: 5, levelStep: 3, sprintTimes: [4.996] }, start + 1)).toMatchObject({ bestSprint: 5, sprintRecord: 5 });
    // 4.994 rounds to 4.99, which is faster.
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.994] }, start + DAY)).toMatchObject({ bestSprint: 4.99, sprintImprovedAt: start + DAY });
  });

  it("rounds half up like the database's numeric round(x, 2)", () => {
    // Exact decimal half-up for every 3-decimal time in range: k thousandths -> floor((k + 5) / 10) hundredths.
    for (let k = 3600; k <= 15000; k++) {
      expect(roundSprint(Number((k / 1000).toFixed(3)))).toBe(Math.floor((k + 5) / 10) / 100);
    }
    // The 5% cap for every 2-decimal record: R hundredths * 0.95 -> floor((R * 95 + 50) / 100) hundredths.
    for (let r = 360; r <= 1500; r++) {
      expect(roundSprint((r / 100) * SPRINT_STEP)).toBe(Math.floor((r * 95 + 50) / 100) / 100);
    }
    expect(roundSprint(4.005)).toBe(4.01);
  });

  it("lets skills rise by at most 3 per 24 hours, and go down at any time", () => {
    const tooSoon = applyScoreUpdate(base, { skills: 20, levelStep: 3, sprintTimes: [5] }, start + DAY - 1);
    expect(tooSoon).toMatchObject({ skills: 5, skillsRaisedAt: start });
    const later = applyScoreUpdate(base, { skills: 20, levelStep: 3, sprintTimes: [5] }, start + DAY);
    expect(later).toMatchObject({ skills: 8, skillsRaisedAt: start + DAY });
    // A rise smaller than 3 is taken whole, but uses up the day.
    const one = applyScoreUpdate(base, { skills: 6, levelStep: 3, sprintTimes: [5] }, start + DAY);
    expect(one).toMatchObject({ skills: 6, skillsRaisedAt: start + DAY });
    expect(applyScoreUpdate(one, { skills: 7, levelStep: 3, sprintTimes: [5] }, start + DAY + 1).skills).toBe(6);
    // Going down is always allowed and leaves the timer alone.
    const down = applyScoreUpdate(later, { skills: 1, levelStep: 3, sprintTimes: [5] }, start + DAY + 1);
    expect(down).toMatchObject({ skills: 1, skillsRaisedAt: start + DAY });
    expect(applyScoreUpdate(down, { skills: 9, levelStep: 3, sprintTimes: [5] }, start + DAY + 2).skills).toBe(1);
    expect(applyScoreUpdate(down, { skills: 9, levelStep: 3, sprintTimes: [5] }, start + 2 * DAY).skills).toBe(4);
  });

  it("takes a slower or cleared sprint straight away", () => {
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [6] }, start + 1).bestSprint).toBe(6);
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [] }, start + 1).bestSprint).toBeNull();
  });

  it("raises the level step by 1 at most, once per 24 hours", () => {
    const tooSoon = applyScoreUpdate(base, { skills: 5, levelStep: 16, sprintTimes: [5] }, start + DAY - 1);
    expect(tooSoon.levelStep).toBe(3);
    const later = applyScoreUpdate(base, { skills: 5, levelStep: 16, sprintTimes: [5] }, start + DAY);
    expect(later).toMatchObject({ levelStep: 4, levelStepRaisedAt: start + DAY });
  });

  it("always allows the level step and skills to go down", () => {
    const next = applyScoreUpdate(base, { skills: 2, levelStep: 1, sprintTimes: [5] }, start + 1);
    expect(next).toMatchObject({ skills: 2, levelStep: 1 });
  });

  it("is the same if the same update is applied twice", () => {
    const once = applyScoreUpdate(base, { skills: 6, levelStep: 4, sprintTimes: [4.8] }, start + DAY);
    const twice = applyScoreUpdate(once, { skills: 6, levelStep: 4, sprintTimes: [4.8] }, start + DAY);
    expect(twice).toEqual(once);
  });
});

describe("cheating limits: skills, timers and cleared results", () => {
  const DAY = IMPROVE_EVERY_MS;
  const start = Date.parse("2026-11-24T10:00:00Z");
  const ids = football.skills.map((s) => s.id);
  const base: ScoreSnapshot = {
    skills: 5, levelStep: 3, bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start, levelStepRaisedAt: start, skillsRaisedAt: start,
  };
  const save = (prev: ScoreSnapshot | null, sprintTimes: number[], at: number, levelStep = 3) =>
    applyScoreUpdate(prev, { skills: 5, levelStep, sprintTimes }, at);

  it("counts only distinct, real skill ids", () => {
    expect(countRankedSkills([], ids)).toBe(0);
    expect(countRankedSkills(["bc1", "bc1", "bc1"], ids)).toBe(1);
    expect(countRankedSkills(["bc1", "made-up", "BC2", "", "ft2"], ids)).toBe(2);
    expect(countRankedSkills(Array.from({ length: 500 }, (_, i) => `x${i}`), ids)).toBe(0);
    expect(countRankedSkills([...ids, ...ids], ids)).toBe(ids.length);
  });

  it("starts all three 24-hour timers on a first save", () => {
    const first = save(null, [5], start, 3);
    expect(first).toEqual({ skills: 3, skillsRaisedAt: start, levelStep: 1, levelStepRaisedAt: start, bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start });
    expect(save(first, [3.6], start + 1, 16)).toMatchObject({ skills: 3, levelStep: 1, bestSprint: 5 });
    expect(save(first, [3.6], start + DAY, 16)).toMatchObject({ skills: 5, levelStep: 2, bestSprint: 4.75, sprintRecord: 4.75 });
  });

  it("starts no timer on a first save without skills, a level step or a sprint", () => {
    const first = applyScoreUpdate(null, { skills: 0, levelStep: 0, sprintTimes: [] }, start);
    expect(first).toEqual({ skills: 0, skillsRaisedAt: null, levelStep: 0, levelStepRaisedAt: null, bestSprint: null, sprintRecord: null, sprintImprovedAt: null });
    // The first real sprint later is still a first sprint: no faster than 4.5 s.
    expect(save(first, [4], start + 1, 1)).toMatchObject({
      skills: 3, skillsRaisedAt: start + 1, levelStep: 1, bestSprint: FIRST_SPRINT_FLOOR, sprintRecord: FIRST_SPRINT_FLOOR, sprintImprovedAt: start + 1,
    });
  });

  it("does not reset the sprint limit when results are cleared", () => {
    const cleared = save(base, [], start + 1);
    expect(cleared).toMatchObject({ bestSprint: null, sprintRecord: 5, sprintImprovedAt: start });
    // A faster time right after clearing gets the record, not the new time.
    const back = save(cleared, [3.6], start + 2);
    expect(back).toMatchObject({ bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start });
    // Once 24 hours have passed, the faster time counts, at most 5% faster than the record.
    expect(save(cleared, [3.6], start + DAY)).toMatchObject({ bestSprint: 4.75, sprintRecord: 4.75, sprintImprovedAt: start + DAY });
  });

  it("takes a time as fast as the record or slower after clearing, without touching the timer", () => {
    const cleared = save(base, [], start + 1);
    expect(save(cleared, [5], start + 2)).toMatchObject({ bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start });
    expect(save(cleared, [7], start + 2)).toMatchObject({ bestSprint: 7, sprintRecord: 5, sprintImprovedAt: start });
  });

  it("keeps a slower current best when a faster time comes too soon", () => {
    const slower = save(base, [6], start + 1);
    expect(slower).toMatchObject({ bestSprint: 6, sprintRecord: 5 });
    expect(save(slower, [4], start + 2)).toMatchObject({ bestSprint: 6, sprintRecord: 5, sprintImprovedAt: start });
  });

  it("leaves everything as it was when there are only impossible times", () => {
    expect(save(base, [2, 20], start + 5 * DAY)).toEqual(base);
    const cleared = save(base, [], start + 1);
    expect(save(cleared, [NaN, 3.5], start + 2)).toEqual(cleared);
  });

  it("does not reset the level timer when the level step goes down", () => {
    const down = save(base, [5], start + 1, 1);
    expect(down).toMatchObject({ levelStep: 1, levelStepRaisedAt: start });
    expect(save(down, [5], start + 2, 2)).toMatchObject({ levelStep: 1 });
    expect(save(down, [5], start + DAY, 4)).toMatchObject({ levelStep: 2, levelStepRaisedAt: start + DAY });
  });
});

describe("the database scoring matches", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/005_leaderboard.sql", import.meta.url), "utf8");

  it("football_skill_ids lists exactly the football skills, once each", () => {
    const body = sql.slice(sql.indexOf("function public.football_skill_ids"));
    const inSql = [...body.slice(body.indexOf("array["), body.indexOf("]::text[]")).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(new Set(inSql).size).toBe(inSql.length);
    expect([...inSql].sort()).toEqual(football.skills.map((s) => s.id).sort());
  });

  it("caps the skills score at the number of football skills", () => {
    const cap = sql.match(/leaderboard_scores_skills_range\s+check \(skills between 0 and (\d+)\)/);
    expect(Number(cap?.[1])).toBe(football.skills.length);
  });

  it("uses the same first-save caps, skills step, sprint floor, 5% step and rounding as applyScoreUpdate", () => {
    const trigger = sql.slice(sql.indexOf("function public.update_leaderboard_score"), sql.indexOf("drop trigger if exists progress_leaderboard"));
    expect(trigger).toContain(`first_skills := least(skill_count, ${SKILLS_PER_DAY});`);
    expect(trigger).toContain("first_step := least(wanted, 1);");
    expect(trigger).toContain(`greatest(sprint, ${FIRST_SPRINT_FLOOR})`);
    expect(trigger).toContain(`least(skill_count, prev.skills + ${SKILLS_PER_DAY})`);
    expect(trigger).toContain(`greatest(sprint, round(prev.sprint_record * ${SPRINT_STEP}, 2))`);
    expect(trigger).toContain("select round(min(v), 2) into sprint");
    expect(trigger).toContain("on conflict (user_id, tree_id) do nothing");
    // The backfill for progress without a score row uses the same first-save caps.
    const backfill = sql.slice(sql.indexOf("insert into public.leaderboard_scores"), sql.indexOf("function public.update_leaderboard_score"));
    expect(backfill).toContain(`least(${SKILLS_PER_DAY}, (select count(distinct d)`);
    expect(backfill).toContain(`greatest(f.sprint, ${FIRST_SPRINT_FLOOR})`);
    expect(backfill).toContain("select round(min(v), 2)");
    expect(backfill).toContain("on conflict (user_id, tree_id) do nothing");
  });
});
