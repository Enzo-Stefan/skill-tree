import { describe, expect, it } from "vitest";
import { SEASONS, type Season } from "../data/seasons";
import { XP_AMOUNTS } from "../data/xp";
import type { ChallengeContext } from "./challenges";
import { activeSeason, seasonAwardKey, seasonChallengeDone, seasonProgress } from "./seasons";
import { amountFor, award, isEventKey, totalXp } from "./xp";

const season: Season = {
  id: "test-season",
  title: "Test",
  start: "2026-12-01",
  end: "2026-12-31",
  challenges: [
    { id: "t-days", goal: { kind: "trainDays", count: 3 }, title: "Days", text: "" },
    { id: "t-pass", goal: { kind: "passSkills", count: 2 }, title: "Pass", text: "" },
    { id: "t-skills", goal: { kind: "differentSkills", count: 2 }, title: "Skills", text: "" },
  ],
};
const ctx = (over: Partial<ChallengeContext> = {}): ChallengeContext => ({ practiceDays: [], sessions: [], passDays: [], ...over });
const c = (id: string) => season.challenges.find((x) => x.id === id)!;

describe("the season data", () => {
  it("has unique ids, valid dates in order, challenges with valid award keys, and no overlap between seasons", () => {
    expect(new Set(SEASONS.map((s) => s.id)).size).toBe(SEASONS.length);
    const sorted = [...SEASONS].sort((a, b) => a.start.localeCompare(b.start));
    sorted.forEach((s, i) => {
      expect(s.start, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.end, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.start <= s.end, s.id).toBe(true);
      if (i > 0) expect(sorted[i - 1]!.end < s.start, `${sorted[i - 1]!.id} and ${s.id} overlap`).toBe(true);
      expect(new Set(s.challenges.map((x) => x.id)).size).toBe(s.challenges.length);
      for (const ch of s.challenges) expect(isEventKey(seasonAwardKey(s, ch)), ch.id).toBe(true);
    });
  });
});

describe("activeSeason", () => {
  it("includes both ends and nothing outside", () => {
    expect(activeSeason("2026-12-01", [season])?.id).toBe("test-season");
    expect(activeSeason("2026-12-31", [season])?.id).toBe("test-season");
    expect(activeSeason("2026-11-30", [season])).toBeNull();
    expect(activeSeason("2027-01-01", [season])).toBeNull();
  });

  it("picks the later-started season when two overlap, and null with none", () => {
    const later: Season = { ...season, id: "later", start: "2026-12-15", end: "2027-01-15" };
    expect(activeSeason("2026-12-20", [season, later])?.id).toBe("later");
    expect(activeSeason("2026-12-10", [season, later])?.id).toBe("test-season");
    expect(activeSeason("2026-12-10", [])).toBeNull();
  });

  it("a new season is only a data change: the real list answers for its own dates", () => {
    expect(activeSeason(SEASONS[0]!.start)?.id).toBe(SEASONS[0]!.id);
    expect(activeSeason("2000-01-01")).toBeNull();
  });
});

describe("progress inside a season", () => {
  it("counts only days between the first and last day", () => {
    const practiceDays = ["2026-11-30", "2026-12-01", "2026-12-15", "2026-12-15", "2026-12-31", "2027-01-01"];
    expect(seasonProgress(season, c("t-days"), ctx({ practiceDays }))).toEqual({ have: 3, need: 3 });
    expect(seasonChallengeDone(season, c("t-days"), ctx({ practiceDays }))).toBe(true);
    expect(seasonChallengeDone(season, c("t-days"), ctx({ practiceDays: practiceDays.slice(0, 2) }))).toBe(false);
  });

  it("counts passes and different skills in the season only", () => {
    expect(seasonProgress(season, c("t-pass"), ctx({ passDays: ["2026-11-30", "2026-12-02", "2027-01-02"] })).have).toBe(1);
    const sessions = [
      { date: "2026-12-02", skillId: "bc1" },
      { date: "2026-12-03", skillId: "bc1" },
      { date: "2026-12-04", skillId: "ps1" },
      { date: "2026-11-20", skillId: "dr1" },
    ];
    expect(seasonProgress(season, c("t-skills"), ctx({ sessions }))).toEqual({ have: 2, need: 2 });
  });
});

describe("award keys", () => {
  it("is one award per challenge and season, worth the seasonal amount, and different for a different season", () => {
    const key = seasonAwardKey(season, c("t-days"));
    expect(key).toBe("challenge:t-days:season-test-season");
    expect(amountFor(key)).toBe(XP_AMOUNTS.challengeSeason);
    expect(seasonAwardKey({ ...season, id: "next" }, c("t-days"))).not.toBe(key);
  });

  it("reaches the ledger once: awarding the key twice pays the seasonal amount once", () => {
    const key = seasonAwardKey(season, c("t-days"));
    let ledger = award([], key, amountFor(key), "2026-12-20T10:00:00.000Z");
    ledger = award(ledger, key, amountFor(key), "2026-12-21T10:00:00.000Z");
    expect(totalXp(ledger)).toBe(XP_AMOUNTS.challengeSeason);
    expect(ledger).toHaveLength(1);
  });
});
