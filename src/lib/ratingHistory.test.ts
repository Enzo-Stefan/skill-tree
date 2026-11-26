// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanSnapshots,
  fetchCard,
  fetchSnapshots,
  loadSnapshots,
  mergeSnapshots,
  pushSnapshots,
  recordWeek,
  saveCard,
  saveSnapshots,
  sameSnapshots,
  type RatingSnapshot,
} from "./ratingHistory";
import type { Ratings } from "./ratings";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-26T10:00:00.000Z";
const ratings = (overall: number, bc = overall): Ratings => ({ branches: { bc, ps: 0 }, overall });
const snap = (week: string, overall: number, at: string): RatingSnapshot => ({ week, ratings: { bc: overall, ps: 0 }, overall, at });

describe("recordWeek", () => {
  it("records this week under its Monday, and changes the same week's snapshot rather than adding another", () => {
    const first = recordWeek([], "2026-11-26", ratings(5), T1);
    expect(first).toEqual([snap("2026-11-23", 5, T1)]);
    const second = recordWeek(first, "2026-11-29", ratings(9), T2);
    expect(second).toEqual([snap("2026-11-23", 9, T2)]);
  });

  it("returns the same list when the numbers did not change", () => {
    const first = recordWeek([], "2026-11-26", ratings(5), T1);
    expect(recordWeek(first, "2026-11-27", ratings(5), T2)).toBe(first);
  });

  it("keeps earlier weeks and sorts oldest first", () => {
    const h = recordWeek([snap("2026-11-16", 3, T1)], "2026-11-26", ratings(5), T2);
    expect(h.map((s) => s.week)).toEqual(["2026-11-16", "2026-11-23"]);
  });
});

describe("cleaning and merging", () => {
  it("drops a week that is not a Monday, a rating outside 0 to 99, bad keys and bad times", () => {
    const cleaned = cleanSnapshots([
      snap("2026-11-23", 5, T1),
      snap("2026-11-24", 5, T1),
      snap("2026-11-30", 150, T1),
      { week: "2026-12-07", ratings: { bc: 120 }, overall: 5, at: T1 },
      { week: "2026-12-14", ratings: { "BAD KEY": 5 }, overall: 5, at: T1 },
      { week: "2026-12-21", ratings: { bc: 5 }, overall: 5, at: "nope" },
      { week: "2026-12-28", ratings: { bc: 5.5 }, overall: 5, at: T1 },
      null,
      "x",
    ]);
    expect(cleaned.map((s) => s.week)).toEqual(["2026-11-23"]);
    expect(cleanSnapshots("nope")).toEqual([]);
  });

  it("keeps the later copy of a week when merging, in either order", () => {
    const a = [snap("2026-11-23", 5, T1), snap("2026-11-16", 3, T1)];
    const b = [snap("2026-11-23", 8, T2)];
    expect(mergeSnapshots(a, b)).toEqual(mergeSnapshots(b, a));
    expect(mergeSnapshots(a, b).find((s) => s.week === "2026-11-23")!.overall).toBe(8);
    expect(mergeSnapshots(mergeSnapshots(a, b), mergeSnapshots(a, b))).toEqual(mergeSnapshots(a, b));
  });

  it("compares histories by content, not order", () => {
    const a = [snap("2026-11-16", 3, T1), snap("2026-11-23", 5, T1)];
    expect(sameSnapshots(a, [...a].reverse())).toBe(true);
    expect(sameSnapshots(a, [a[0]!, snap("2026-11-23", 6, T1)])).toBe(false);
  });
});

describe("this browser's copy", () => {
  beforeEach(() => localStorage.clear());
  it("saves and loads per tree and survives broken storage", () => {
    saveSnapshots("football", [snap("2026-11-23", 5, T1)]);
    expect(loadSnapshots("football")).toEqual([snap("2026-11-23", 5, T1)]);
    expect(loadSnapshots("weights")).toEqual([]);
    localStorage.setItem("skill-tree:football:ratings", "not json");
    expect(loadSnapshots("football")).toEqual([]);
  });
});

describe("the account's copy", () => {
  it("reads the rows and sends snapshots 300 at a time", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ week: "2026-11-23", ratings: { bc: 5 }, overall: 5, at: T1 }], error: null });
    const client = { from: () => ({ select: () => ({ eq: () => ({ limit }) }) }) } as unknown as SupabaseClient;
    expect(await fetchSnapshots(client, "football")).toEqual([{ week: "2026-11-23", ratings: { bc: 5 }, overall: 5, at: T1 }]);

    const rpc = vi.fn().mockResolvedValue({ error: null });
    const many = Array.from({ length: 450 }, (_, i) => snap(`2026-01-${String(i)}`, 1, T1));
    await pushSnapshots({ rpc } as unknown as SupabaseClient, "football", many);
    expect(rpc).toHaveBeenCalledTimes(2);
    rpc.mockClear();
    await pushSnapshots({ rpc } as unknown as SupabaseClient, "football", []);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws when a call fails, so the caller keeps its own copy", async () => {
    const bad = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { message: "no table" } }) }) }) }), rpc: async () => ({ error: { message: "no function" } }) } as unknown as SupabaseClient;
    await expect(fetchSnapshots(bad, "football")).rejects.toThrow(/no table/);
    await expect(pushSnapshots(bad, "football", [snap("2026-11-23", 1, T1)])).rejects.toThrow(/no function/);
  });
});

describe("position and preferred foot", () => {
  it("reads them, treating anything else as not set", async () => {
    const make = (row: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }) as unknown as SupabaseClient;
    expect(await fetchCard(make({ player_position: "MID", preferred_foot: "left" }), "u1")).toEqual({ position: "MID", foot: "left" });
    expect(await fetchCard(make(null), "u1")).toEqual({ position: null, foot: null });
    expect(await fetchCard(make({ player_position: "STRIKER", preferred_foot: "middle" }), "u1")).toEqual({ position: null, foot: null });
  });

  it("saves them against the player's own id", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    await saveCard({ from: () => ({ upsert }) } as unknown as SupabaseClient, "u1", { position: "GK", foot: "both" });
    expect(upsert).toHaveBeenCalledWith({ user_id: "u1", player_position: "GK", preferred_foot: "both" }, { onConflict: "user_id" });
  });
});
