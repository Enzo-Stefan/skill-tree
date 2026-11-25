import { describe, expect, it } from "vitest";
import type { LeaderboardProfile, Tree } from "../types";
import { flagEmoji, levelStepName, nameProblem, needsHemispherePick, profileToRow, scopeAvailable, toResult } from "./leaderboardApi";
import { LEADERBOARD_LIMIT } from "./leaderboard";

const profile = (over: Partial<LeaderboardProfile> = {}): LeaderboardProfile => ({
  displayName: "Leo",
  countryCode: null,
  city: null,
  hemisphere: null,
  leaderboardOptIn: true,
  ...over,
});

describe("name problems for the screen", () => {
  it("maps the rule codes to the ones the screen translates", () => {
    expect(nameProblem("Leo")).toBeNull();
    expect(nameProblem("ab")).toBe("short");
    expect(nameProblem("a".repeat(21))).toBe("long");
    expect(nameProblem("hi<script>")).toBe("characters");
    expect(nameProblem("FuckYou")).toBe("blocked");
  });
});

describe("places", () => {
  it("asks for a hemisphere only where the country crosses the equator", () => {
    expect(needsHemispherePick("BR")).toBe(true);
    expect(needsHemispherePick("ES")).toBe(false);
    expect(needsHemispherePick(null)).toBe(false);
  });

  it("writes flags from ISO codes", () => {
    expect(flagEmoji("ES")).toBe("🇪🇸");
    expect(flagEmoji("us")).toBe("🇺🇸");
    expect(flagEmoji(null)).toBe("");
    expect(flagEmoji("USA")).toBe("");
  });

  it("offers a scope only when the player has filled in what it needs", () => {
    expect(scopeAvailable("global", null)).toBe(true);
    expect(scopeAvailable("country", null)).toBe(false);
    expect(scopeAvailable("country", profile({ countryCode: "ES" }))).toBe(true);
    expect(scopeAvailable("continent", profile({ countryCode: "ES" }))).toBe(true);
    expect(scopeAvailable("hemisphere", profile({ countryCode: "BR" }))).toBe(false);
    expect(scopeAvailable("hemisphere", profile({ countryCode: "BR", hemisphere: "S" }))).toBe(true);
  });
});

describe("saving a profile", () => {
  it("trims text, never sends a city and works out the hemisphere", () => {
    expect(profileToRow("u1", profile({ displayName: " Leo ", countryCode: "es", city: "Madrid" }))).toEqual({
      user_id: "u1",
      display_name: "Leo",
      country_code: "ES",
      hemisphere: "N",
      leaderboard_opt_in: true,
    });
  });

  it("keeps the pick for a country that crosses the equator and ignores one for any other", () => {
    expect(profileToRow("u1", profile({ countryCode: "BR", hemisphere: "N" })).hemisphere).toBe("N");
    expect(profileToRow("u1", profile({ countryCode: "AU", hemisphere: "N" })).hemisphere).toBe("S");
  });

  it("ignores a country that isn't in the table", () => {
    const row = profileToRow("u1", profile({ countryCode: "ZZ", hemisphere: "S", city: "x".repeat(80) }));
    expect(row.country_code).toBeNull();
    expect(row.hemisphere).toBeNull();
    expect(row).not.toHaveProperty("city");
  });
});

describe("level steps", () => {
  const tree = {
    playerLevels: ["Beginner", "Intermediate", "Advanced", "Expert"].map((name) => ({ id: name.toLowerCase(), name, hint: "" })),
  } as Tree;

  it("names step 1 to 16", () => {
    expect(levelStepName(tree, 1)).toBe("Beginner 1");
    expect(levelStepName(tree, 5)).toBe("Intermediate 1");
    expect(levelStepName(tree, 16)).toBe("Expert 4");
    expect(levelStepName(tree, 17)).toBeNull();
  });
});

describe("the database's answer", () => {
  const row = (rank: number, name: string, isMe = false) => ({
    rank,
    display_name: name,
    country_code: "ES",
    skills: "12",
    level_step: 5,
    best_sprint: "5.61",
    is_me: isMe,
  });

  it("turns rows into camel-case fields and numbers", () => {
    const { top, me } = toResult([{ ...row(1, "a"), best_sprint: null }, row(2, "b")]);
    expect(top[0]).toEqual({ rank: 1, displayName: "a", countryCode: "ES", skills: 12, levelStep: 5, bestSprint: null, isMe: false });
    expect(top[1].bestSprint).toBe(5.61);
    expect(me).toBeNull();
  });

  it("splits the player's own row off when it comes after the top 50", () => {
    const rows = Array.from({ length: LEADERBOARD_LIMIT }, (_, i) => row(i + 1, `p${i}`));
    rows.push(row(4000, "me", true));
    const { top, me } = toResult(rows);
    expect(top).toHaveLength(LEADERBOARD_LIMIT);
    expect(me?.rank).toBe(4000);
  });

  it("leaves the player's row in the list when it is inside the top 50", () => {
    const { top, me } = toResult([row(1, "a"), row(2, "me", true)]);
    expect(top[1].isMe).toBe(true);
    expect(me).toBeNull();
  });
});
