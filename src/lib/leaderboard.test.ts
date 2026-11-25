import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/005_leaderboard.sql?raw";
import {
  BLOCKED_STEMS,
  BLOCKED_WORDS,
  IMPROVE_EVERY_MS,
  applyScoreUpdate,
  bestPossibleSprint,
  boardFor,
  displayNameError,
  inScope,
  levelStepOf,
  normalizeCity,
  rankEntries,
  type BoardEntry,
  type ScoreSnapshot,
  type Viewer,
} from "./leaderboard";

const entry = (userId: string, over: Partial<BoardEntry> = {}): BoardEntry => ({
  userId,
  displayName: userId,
  countryCode: "AL",
  city: null,
  hemisphere: null,
  skills: 10,
  levelStep: 5,
  bestSprint: 5,
  ...over,
});

const viewer = (over: Partial<Viewer> = {}): Viewer => ({ userId: "me", countryCode: "AL", city: null, hemisphere: null, ...over });

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
  const me = viewer({ countryCode: "AL", city: "Tirana" });
  const tirana = entry("t", { countryCode: "AL", city: "  tirana " });
  const durres = entry("d", { countryCode: "AL", city: "Durrës" });
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

  it("local is the same city in the same country, ignoring case and spaces", () => {
    expect(inScope(me, tirana, "local")).toBe(true);
    expect(inScope(me, durres, "local")).toBe(false);
    expect(inScope(me, entry("x", { countryCode: "IT", city: "Tirana" }), "local")).toBe(false);
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
    for (const scope of ["continent", "hemisphere", "country", "local"] as const) {
      expect(inScope(nobody, italy, scope), scope).toBe(false);
      expect(inScope(nobody, entry("me"), scope), scope).toBe(true);
    }
    const noCity = viewer({ countryCode: "AL", city: null });
    expect(inScope(noCity, tirana, "local")).toBe(false);
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

  it("never returns the city or the user id", () => {
    const rows = boardFor([entry("me", { city: "Tirana" })], viewer(), "global");
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
    for (const name of [
      "Grape Fan", "Economy", "Computadora", "Pitufo", "Drape", "Raptor", "Putamen", "Puton",
      "Chingachgook", "Maricarmen", "Cumulo", "Culottes",
    ]) expect(displayNameError(name), name).toBeNull();
  });

  it("blocks the newer words and their plurals as whole words", () => {
    for (const name of ["culo", "Culos", "marica", "maricon", "Maricones", "chinga", "chingas", "putas", "Putos", "c u l o", "mar.ica", "CUL0"]) {
      expect(displayNameError(name), name).toBe("blocked");
    }
  });

  it("keeps the word lists equal to display_name_blocked in 005_leaderboard.sql", () => {
    const stems = [...migration.matchAll(/array\['([^\]]+)'\]/g)].map((m) => m[1]!.split("','"));
    expect(stems[0]).toEqual(BLOCKED_STEMS);
    const patterns = [...migration.matchAll(/~ '\^\(([^)]+)\)\(s\|es\)\?\$'/g)].map((m) => m[1]!.split("|"));
    expect(patterns).toHaveLength(2);
    for (const words of patterns) expect(words).toEqual(BLOCKED_WORDS);
  });
});

describe("cities", () => {
  it("are matched trimmed, lower case, with inner spaces collapsed", () => {
    expect(normalizeCity("  New   York ")).toBe("new york");
    expect(normalizeCity("   ")).toBeNull();
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity("x".repeat(100))).toHaveLength(60);
  });
});

describe("cheating limits", () => {
  const DAY = IMPROVE_EVERY_MS;
  const start = Date.parse("2026-11-24T10:00:00Z");
  const base: ScoreSnapshot = { skills: 5, levelStep: 3, bestSprint: 5, sprintImprovedAt: start, levelStepRaisedAt: start };

  it("picks the fastest possible sprint, so an impossible time can't hide a real one", () => {
    expect(bestPossibleSprint([2.1, 5.4, 4.9, 20])).toBe(4.9);
    expect(bestPossibleSprint([2.1, 20])).toBeNull();
    expect(bestPossibleSprint([])).toBeNull();
  });

  it("takes a first score as it is, and ignores an impossible first sprint", () => {
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 16, bestSprint: 5 }, start)).toMatchObject({ skills: 3, levelStep: 16, bestSprint: 5 });
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, bestSprint: 3.5 }, start).bestSprint).toBeNull();
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, bestSprint: 15.1 }, start).bestSprint).toBeNull();
    expect(applyScoreUpdate(null, { skills: 3, levelStep: 2, bestSprint: 3.6 }, start).bestSprint).toBe(3.6);
  });

  it("ignores an impossible sprint later on and keeps the old one", () => {
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, bestSprint: 2 }, start + 5 * DAY).bestSprint).toBe(5);
  });

  it("lets the best sprint get faster once per 24 hours", () => {
    const tooSoon = applyScoreUpdate(base, { skills: 5, levelStep: 3, bestSprint: 4.5 }, start + DAY - 1);
    expect(tooSoon.bestSprint).toBe(5);
    const later = applyScoreUpdate(base, { skills: 5, levelStep: 3, bestSprint: 4.5 }, start + DAY);
    expect(later).toMatchObject({ bestSprint: 4.5, sprintImprovedAt: start + DAY });
  });

  it("takes a slower or cleared sprint straight away", () => {
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, bestSprint: 6 }, start + 1).bestSprint).toBe(6);
    expect(applyScoreUpdate(base, { skills: 5, levelStep: 3, bestSprint: null }, start + 1).bestSprint).toBeNull();
  });

  it("raises the level step by 1 at most, once per 24 hours", () => {
    const tooSoon = applyScoreUpdate(base, { skills: 5, levelStep: 16, bestSprint: 5 }, start + DAY - 1);
    expect(tooSoon.levelStep).toBe(3);
    const later = applyScoreUpdate(base, { skills: 5, levelStep: 16, bestSprint: 5 }, start + DAY);
    expect(later).toMatchObject({ levelStep: 4, levelStepRaisedAt: start + DAY });
  });

  it("always allows the level step and skills to go down", () => {
    const next = applyScoreUpdate(base, { skills: 2, levelStep: 1, bestSprint: 5 }, start + 1);
    expect(next).toMatchObject({ skills: 2, levelStep: 1 });
  });

  it("is the same if the same update is applied twice", () => {
    const once = applyScoreUpdate(base, { skills: 6, levelStep: 4, bestSprint: 4.8 }, start + DAY);
    const twice = applyScoreUpdate(once, { skills: 6, levelStep: 4, bestSprint: 4.8 }, start + DAY);
    expect(twice).toEqual(once);
  });
});
