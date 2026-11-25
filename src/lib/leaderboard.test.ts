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
  SCRIPT_CLASSES,
  IMPROVE_EVERY_MS,
  applyScoreUpdate,
  bestPossibleSprint,
  countRankedSkills,
  boardFor,
  displayNameError,
  inScope,
  levelStepOf,
  rankEntries,
  type BoardEntry,
  type ScoreSnapshot,
  type Viewer,
} from "./leaderboard";

const entry = (userId: string, over: Partial<BoardEntry> = {}): BoardEntry => ({
  userId,
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

  it("orders ties the same way every time, by id", () => {
    const a = rankEntries([entry("b"), entry("a")]).map((r) => r.entry.userId);
    const b = rankEntries([entry("a"), entry("b")]).map((r) => r.entry.userId);
    expect(a).toEqual(["a", "b"]);
    expect(b).toEqual(a);
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

  it("ranks inside the scope, so the same player has a different rank in their country", () => {
    const entries = [entry("a", { skills: 30, countryCode: "IT" }), entry("me", { skills: 20, countryCode: "AL" }), entry("b", { skills: 10, countryCode: "AL" })];
    expect(boardFor(entries, viewer(), "global").find((r) => r.isMe)!.rank).toBe(2);
    expect(boardFor(entries, viewer(), "country").find((r) => r.isMe)!.rank).toBe(1);
  });

  it("never returns the user id", () => {
    const rows = boardFor([entry("me")], viewer(), "global");
    expect(Object.keys(rows[0]).sort()).toEqual(["bestSprint", "countryCode", "displayName", "isMe", "levelStep", "rank", "skills"]);
  });

  it("ranks by one test alone when asked", () => {
    const entries = [entry("me", { testValue: 6 }), entry("a", { testValue: 5 }), entry("b", { testValue: null })];
    const rows = boardFor(entries, viewer(), "global", { byTest: { better: "lower" } });
    expect(rows.map((r) => [r.displayName, r.rank])).toEqual([["a", 1], ["me", 2]]);
  });
});

describe("display names", () => {
  it("accepts ordinary names", () => {
    for (const name of ["Stefan", "Ana María", "Leo_10", "Jo-Ann.K", "Lü Bu"]) expect(displayNameError(name), name).toBeNull();
  });

  it("checks the length after trimming", () => {
    expect(displayNameError("ab")).toBe("too-short");
    expect(displayNameError("  a  ")).toBe("too-short");
    expect(displayNameError("a".repeat(21))).toBe("too-long");
    expect(displayNameError("a".repeat(20))).toBeNull();
  });

  it("rejects email addresses and odd characters", () => {
    expect(displayNameError("me@school.com")).toBe("characters");
    expect(displayNameError("<b>bold</b>")).toBe("characters");
    expect(displayNameError("_underscore")).toBe("characters");
  });

  it("blocks English and Spanish words, including look-alikes and accents", () => {
    for (const name of ["fuck_you", "xXfuckXx", "SH1T", "m1erda", "Pendejo99", "p u t a", "viólar", "n1gga"]) {
      expect(displayNameError(name), name).toBe("blocked");
    }
  });

  it("does not block innocent names that contain a short blocked word", () => {
    for (const name of ["Grape Fan", "Economy", "Computadora", "Pitufo", "Drape"]) expect(displayNameError(name), name).toBeNull();
  });

  it("does not block known innocent words that hold a blocked stem", () => {
    for (const name of ["Scunthorpe FC", "Snigger", "Niggling Doubt", "Shitake Fan", "Yamashita", "Ken Kinoshita", "Mishit", "Pushitup"]) {
      expect(displayNameError(name), name).toBeNull();
    }
  });

  it("still blocks a stem next to an innocent word", () => {
    for (const name of ["ScunthorpeFuck", "Snigga", "shitakeshit", "Faggot99"]) expect(displayNameError(name), name).toBe("blocked");
  });

  it("accepts names written wholly in Cyrillic or Greek", () => {
    for (const name of ["Иван", "Наталья", "Νίκος", "Ελένη"]) expect(displayNameError(name), name).toBeNull();
  });

  it("refuses names that mix Latin with Cyrillic or Greek letters", () => {
    // "fuсk" with a Cyrillic с, "Pаblo" with a Cyrillic а, "Nικος" with a Latin N.
    for (const name of ["fu\u0441k", "P\u0430blo", "N\u03B9\u03BA\u03BF\u03C2"]) expect(displayNameError(name), name).toBe("characters");
  });

  it("blocks Cyrillic and Greek look-alike spellings", () => {
    // ЅНІТ, ѕһ1т and ВІТСН in Cyrillic; ρυτα and ΝΑΖΙ in Greek.
    for (const name of ["\u0405\u041D\u0406\u0422", "\u0455\u04BB1\u0442", "\u0412\u0406\u0422\u0421\u041D", "\u03C1\u03C5\u03C4\u03B1 99", "\u039D\u0391\u0396\u0399"]) {
      expect(displayNameError(name), name).toBe("blocked");
    }
  });
});

describe("the database name check matches this one", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/005_leaderboard.sql", import.meta.url), "utf8");
  const fn = sql.slice(sql.indexOf("function public.display_name_blocked"), sql.indexOf("function public.check_display_name"));
  const sqlArray = (name: string) => {
    const m = fn.match(new RegExp(`${name}\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
  };
  const sqlText = (name: string) => fn.match(new RegExp(`${name}\\s+text\\s*:=\\s*'([^']*)'`))?.[1] ?? null;

  it("has the same blocked stems, blocked words and allowed words", () => {
    expect(sqlArray("blocked_stems")).toEqual(BLOCKED_STEMS);
    expect(sqlArray("blocked_words")).toEqual(BLOCKED_WORDS);
    expect(sqlArray("allowed_words")).toEqual(ALLOWED_WORDS);
  });

  it("has the same look-alike maps, each pair the same length so nothing is silently dropped", () => {
    expect(sqlText("homoglyph_from")).toBe(HOMOGLYPH_FROM);
    expect(sqlText("homoglyph_to")).toBe(HOMOGLYPH_TO);
    expect(sqlText("lookalike_from")).toBe(LOOKALIKE_FROM);
    expect(sqlText("lookalike_to")).toBe(LOOKALIKE_TO);
    expect([...HOMOGLYPH_FROM]).toHaveLength([...HOMOGLYPH_TO].length);
    expect([...LOOKALIKE_FROM]).toHaveLength([...LOOKALIKE_TO].length);
    expect(new Set(HOMOGLYPH_FROM).size).toBe([...HOMOGLYPH_FROM].length);
  });

  it("refuses the same mix of alphabets", () => {
    const check = sql.slice(sql.indexOf("add constraint profiles_display_name_one_script"));
    const inSql = [...check.slice(0, check.indexOf(";")).matchAll(/~ '([^']+)'/g)].map((m) => m[1]);
    expect(inSql).toEqual(SCRIPT_CLASSES);
  });
});

describe("cheating limits", () => {
  const DAY = IMPROVE_EVERY_MS;
  const start = Date.parse("2026-11-24T10:00:00Z");
  const base: ScoreSnapshot = { skills: 5, levelStep: 3, bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start, levelStepRaisedAt: start };

  it("picks the fastest possible sprint, so an impossible time can't hide a real one", () => {
    expect(bestPossibleSprint([2.1, 5.4, 4.9, 20])).toBe(4.9);
    expect(bestPossibleSprint([2.1, 20])).toBeNull();
    expect(bestPossibleSprint([])).toBeNull();
  });

  it("takes a first score as it is, and ignores an impossible first sprint", () => {
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 16, sprintTimes: [5] }, start)).toMatchObject({ skills: 3, levelStep: 16, bestSprint: 5, sprintRecord: 5 });
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, sprintTimes: [3.5] }, start).bestSprint).toBeNull();
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, sprintTimes: [15.1] }, start).bestSprint).toBeNull();
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, sprintTimes: [3.6] }, start).bestSprint).toBe(3.6);
  });

  it("ignores an impossible sprint later on and keeps the old one", () => {
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [2] }, start + 5 * DAY).bestSprint).toBe(5);
  });

  it("lets the best sprint get faster once per 24 hours", () => {
    const tooSoon = applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.5] }, start + DAY - 1);
    expect(tooSoon.bestSprint).toBe(5);
    const later = applyScoreUpdate(base, { skills: 5, levelStep: 3, sprintTimes: [4.5] }, start + DAY);
    expect(later).toMatchObject({ bestSprint: 4.5, sprintRecord: 4.5, sprintImprovedAt: start + DAY });
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
  const base: ScoreSnapshot = { skills: 5, levelStep: 3, bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start, levelStepRaisedAt: start };
  const save = (prev: ScoreSnapshot | null, sprintTimes: number[], at: number, levelStep = 3) =>
    applyScoreUpdate(prev, { skills: 5, levelStep, sprintTimes }, at);

  it("counts only distinct, real skill ids", () => {
    expect(countRankedSkills([], ids)).toBe(0);
    expect(countRankedSkills(["bc1", "bc1", "bc1"], ids)).toBe(1);
    expect(countRankedSkills(["bc1", "made-up", "BC2", "", "ft2"], ids)).toBe(2);
    expect(countRankedSkills(Array.from({ length: 500 }, (_, i) => `x${i}`), ids)).toBe(0);
    expect(countRankedSkills([...ids, ...ids], ids)).toBe(ids.length);
  });

  it("starts both 24-hour timers on a first save", () => {
    const first = save(null, [5], start, 3);
    expect(first).toEqual({ skills: 5, levelStep: 3, levelStepRaisedAt: start, bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start });
    expect(save(first, [3.6], start + 1, 16)).toMatchObject({ levelStep: 3, bestSprint: 5 });
    expect(save(first, [3.6], start + DAY, 16)).toMatchObject({ levelStep: 4, bestSprint: 3.6, sprintRecord: 3.6 });
  });

  it("starts no timer on a first save without a level step or a sprint", () => {
    const first = save(null, [], start, 0);
    expect(first).toEqual({ skills: 5, levelStep: 0, levelStepRaisedAt: null, bestSprint: null, sprintRecord: null, sprintImprovedAt: null });
    expect(save(first, [4], start + 1, 1)).toMatchObject({ levelStep: 1, bestSprint: 4, sprintRecord: 4, sprintImprovedAt: start + 1 });
  });

  it("does not reset the sprint limit when results are cleared", () => {
    const cleared = save(base, [], start + 1);
    expect(cleared).toMatchObject({ bestSprint: null, sprintRecord: 5, sprintImprovedAt: start });
    // A faster time right after clearing gets the record, not the new time.
    const back = save(cleared, [3.6], start + 2);
    expect(back).toMatchObject({ bestSprint: 5, sprintRecord: 5, sprintImprovedAt: start });
    // Once 24 hours have passed, the faster time counts.
    expect(save(cleared, [3.6], start + DAY)).toMatchObject({ bestSprint: 3.6, sprintRecord: 3.6, sprintImprovedAt: start + DAY });
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
});
