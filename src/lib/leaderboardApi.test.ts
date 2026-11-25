import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaderboardProfile, Tree } from "../types";
import { flagEmoji, LeaderboardError, levelStepName, nameProblem, needsHemispherePick, profileToRow, reportRow, scopeAvailable, toResult } from "./leaderboardApi";
import { LEADERBOARD_LIMIT } from "./leaderboard";

const profile = (over: Partial<LeaderboardProfile> = {}): LeaderboardProfile => ({
  displayName: "Leo",
  countryCode: null,
  hemisphere: null,
  leaderboardOptIn: true,
  ...over,
});

describe("reporting a row", () => {
  const fakeClient = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient;

  it("calls report_row with the row key and reason", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await reportRow(fakeClient(rpc), "row-1", "looks fake");
    expect(rpc).toHaveBeenCalledWith("report_row", { row_key: "row-1", reason: "looks fake" });
  });

  const failWith = async (code: string | undefined, message: string) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code, message } });
    return (await reportRow(fakeClient(rpc), "row-1", "spam").catch((e: unknown) => e)) as LeaderboardError;
  };

  it.each([
    ["42501", "permission denied for function report_row", "signedOut"],
    ["28000", "Sign in to report a row.", "signedOut"],
    ["P0001", "Too many reports today.", "rateLimited"],
    ["XX000", "boom", "failed"],
  ])("maps SQLSTATE %s to %s and keeps the code", async (code, message, expected) => {
    const error = await failWith(code, message);
    expect(error).toBeInstanceOf(LeaderboardError);
    expect(error.code).toBe(expected);
    expect(error.dbCode).toBe(code);
    expect(error.message).toBe(message);
  });

  it("does not match on the message text", async () => {
    expect((await failWith("XX000", "Too many reports today.")).code).toBe("failed");
    expect((await failWith(undefined, "Sign in to report a row.")).code).toBe("failed");
  });
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
  it("trims text and works out the hemisphere", () => {
    expect(profileToRow("u1", profile({ displayName: " Leo ", countryCode: "es" }))).toEqual({
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
    const row = profileToRow("u1", profile({ countryCode: "ZZ", hemisphere: "S" }));
    expect(row.country_code).toBeNull();
    expect(row.hemisphere).toBeNull();
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
    row_key: `key-${rank}`,
    display_name: name,
    country_code: "ES",
    skills: "12",
    level_step: 5,
    best_sprint: "5.61",
    is_me: isMe,
  });

  it("turns rows into camel-case fields and numbers", () => {
    const { top, me } = toResult([{ ...row(1, "a"), best_sprint: null }, row(2, "b")]);
    expect(top[0]).toEqual({ rank: 1, rowKey: "key-1", displayName: "a", countryCode: "ES", skills: 12, levelStep: 5, bestSprint: null, isMe: false });
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
