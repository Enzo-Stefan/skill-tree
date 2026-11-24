import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { football } from "../data/football";
import {
  cleanProgress,
  createCloudSaver,
  fetchCloudProgress,
  mergeProgress,
  syncOnSignIn,
  type SavedProgress,
} from "./cloud";

const noStreak = { since: null, askedWeek: null };
const empty: SavedProgress = { done: [], playerLevel: null, playerStep: 1, practiceDays: [], streak: noStreak };

describe("mergeProgress (first sign-in on a device)", () => {
  it("keeps finished skills from both the browser and the account", () => {
    const local = { ...empty, done: ["root", "bc1"] };
    const cloud = { ...empty, done: ["root", "ps1"] };
    expect(mergeProgress(football, local, cloud).done.sort()).toEqual(["bc1", "ps1", "root"]);
  });

  it("keeps training days from both, once each, in date order", () => {
    const local = { ...empty, practiceDays: ["2026-11-20", "2026-11-18"] };
    const cloud = { ...empty, practiceDays: ["2026-11-18", "2026-11-16"] };
    expect(mergeProgress(football, local, cloud).practiceDays).toEqual(["2026-11-16", "2026-11-18", "2026-11-20"]);
  });

  it("uses the browser's progress when the account is new", () => {
    const local = { done: ["root"], playerLevel: "advanced", playerStep: 3, practiceDays: ["2026-11-20"], streak: { since: "2026-11-16", askedWeek: null } };
    expect(mergeProgress(football, local, null)).toEqual(local);
  });

  it("keeps the account's level and streak over the browser's", () => {
    const local = { ...empty, playerLevel: "beginner", playerStep: 4, streak: { since: "2026-11-16", askedWeek: null } };
    const cloud = { ...empty, playerLevel: "expert", playerStep: 2, streak: { since: "2026-10-05", askedWeek: "2026-11-09" } };
    const merged = mergeProgress(football, local, cloud);
    expect(merged.playerLevel).toBe("expert");
    expect(merged.playerStep).toBe(2);
    expect(merged.streak).toEqual({ since: "2026-10-05", askedWeek: "2026-11-09" });
  });

  it("takes the browser's level and streak when the account has no level", () => {
    const local = { ...empty, playerLevel: "intermediate", streak: { since: "2026-11-16", askedWeek: null } };
    const merged = mergeProgress(football, local, empty);
    expect(merged.playerLevel).toBe("intermediate");
    expect(merged.streak.since).toBe("2026-11-16");
  });
});

describe("cleanProgress (old or broken saves)", () => {
  it("drops skills and levels the tree no longer has", () => {
    const cleaned = cleanProgress(football, { ...empty, done: ["root", "gone", "root"], playerLevel: "legend" });
    expect(cleaned.done).toEqual(["root"]);
    expect(cleaned.playerLevel).toBeNull();
  });

  it("drops training days that aren't real dates", () => {
    const days = ["2026-11-20", "yesterday", "", "2026-02-31", "2026-13-01", "2028-02-29"];
    expect(cleanProgress(football, { ...empty, practiceDays: days }).practiceDays).toEqual(["2026-11-20", "2028-02-29"]);
  });

  it("drops an impossible streak date", () => {
    const p = { ...empty, playerLevel: "beginner", streak: { since: "2026-02-30", askedWeek: "2026-11-23" } };
    expect(cleanProgress(football, p).streak).toEqual({ since: null, askedWeek: "2026-11-23" });
  });

  it("keeps the step between 1 and 4", () => {
    expect(cleanProgress(football, { ...empty, playerLevel: "beginner", playerStep: 9 }).playerStep).toBe(1);
  });

  it("clears the streak when there is no valid level", () => {
    const cleaned = cleanProgress(football, { ...empty, playerLevel: "legend", streak: { since: "2026-11-16", askedWeek: null } });
    expect(cleaned.streak).toEqual(noStreak);
  });
});

/** A stand-in for the Supabase client that records what the app sends. */
function fakeClient(row: object | null, error: { message: string } | null = null) {
  const upserts: unknown[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error }),
    upsert: async (value: unknown) => {
      upserts.push(value);
      return { error };
    },
  };
  const client = { from: () => query } as unknown as SupabaseClient;
  return { client, upserts };
}

const savedRow = {
  done: ["root"],
  player_level: "expert",
  player_step: 3,
  practice_days: ["2026-11-20"],
  streak_since: "2026-11-02",
  streak_asked_week: null,
};

describe("loading and saving", () => {
  it("reads a saved row", async () => {
    expect(await fetchCloudProgress(fakeClient(savedRow).client, "u1", "football")).toEqual({
      done: ["root"],
      playerLevel: "expert",
      playerStep: 3,
      practiceDays: ["2026-11-20"],
      streak: { since: "2026-11-02", askedWeek: null },
    });
  });

  it("returns null for a player who has never saved", async () => {
    expect(await fetchCloudProgress(fakeClient(null).client, "u1", "football")).toBeNull();
  });

  it("explains what failed when Supabase returns an error", async () => {
    await expect(fetchCloudProgress(fakeClient(null, { message: "offline" }).client, "u1", "football")).rejects.toThrow(
      "Couldn't load your saved progress: offline",
    );
  });

  it("on sign-in, merges and saves the result back to the account", async () => {
    const { client, upserts } = fakeClient({ ...savedRow, player_level: null, done: ["ps1"] });
    const local = { ...empty, done: ["root"], playerLevel: "beginner", practiceDays: ["2026-11-21"] };
    const merged = await syncOnSignIn(client, "u1", football, local);
    expect(merged.done.sort()).toEqual(["ps1", "root"]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      user_id: "u1",
      tree_id: "football",
      player_level: "beginner",
      practice_days: ["2026-11-20", "2026-11-21"],
    });
  });
});

describe("createCloudSaver", () => {
  afterEach(() => vi.useRealTimers());

  it("sends one save for several quick changes, with the latest progress", async () => {
    vi.useFakeTimers();
    const { client, upserts } = fakeClient(null);
    const saver = createCloudSaver(client, "u1", "football", () => {});
    saver.save({ ...empty, done: ["root"] });
    saver.save({ ...empty, done: ["root", "bc1"] });
    await vi.runAllTimersAsync();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ done: ["root", "bc1"] });
  });

  it("never lets an older save finish after a newer one", async () => {
    vi.useFakeTimers();
    // The first save is slow. While it is still running, the player makes another change.
    const finished: string[][] = [];
    let release!: () => void;
    let calls = 0;
    const query = {
      upsert: async (value: { done: string[] }) => {
        calls++;
        if (calls === 1) await new Promise<void>((r) => (release = r));
        finished.push(value.done);
        return { error: null };
      },
    };
    const client = { from: () => query } as unknown as SupabaseClient;
    const saver = createCloudSaver(client, "u1", "football", () => {});
    saver.save({ ...empty, done: ["root"] });
    await vi.advanceTimersByTimeAsync(800); // first save starts and hangs
    saver.save({ ...empty, done: ["root", "bc1"] });
    await vi.advanceTimersByTimeAsync(800); // second save is queued, not sent yet
    expect(calls).toBe(1);
    release();
    await vi.runAllTimersAsync();
    expect(finished).toEqual([["root"], ["root", "bc1"]]);
  });

  it("reports a failed save instead of crashing", async () => {
    const errors: string[] = [];
    const saver = createCloudSaver(fakeClient(null, { message: "offline" }).client, "u1", "football", (m) => errors.push(m));
    saver.save(empty);
    await saver.flush();
    expect(errors).toEqual(["Couldn't save your progress: offline"]);
  });

  /** A client whose saves fail until `online` is set to true. */
  function flakyClient() {
    const state = { online: false, saved: [] as { done: string[] }[] };
    const query = {
      upsert: async (value: { done: string[] }) => {
        if (!state.online) return { error: { message: "offline" } };
        state.saved.push(value);
        return { error: null };
      },
    };
    return { client: { from: () => query } as unknown as SupabaseClient, state };
  }

  it("keeps a failed save and sends it on the next try", async () => {
    const { client, state } = flakyClient();
    let savedCalls = 0;
    const saver = createCloudSaver(client, "u1", "football", () => {}, 800, () => savedCalls++);
    saver.save({ ...empty, done: ["root"] });
    await saver.flush();
    expect(saver.hasPending()).toBe(true);
    expect(savedCalls).toBe(0);
    state.online = true;
    await saver.flush();
    expect(state.saved.map((s) => s.done)).toEqual([["root"]]);
    expect(saver.hasPending()).toBe(false);
    expect(savedCalls).toBe(1);
  });

  it("after a failed save, a newer change wins over the failed one", async () => {
    const { client, state } = flakyClient();
    const saver = createCloudSaver(client, "u1", "football", () => {});
    saver.save({ ...empty, done: ["root"] });
    await saver.flush();
    saver.save({ ...empty, done: ["root", "bc1"] });
    state.online = true;
    await saver.flush();
    expect(state.saved.map((s) => s.done)).toEqual([["root", "bc1"]]);
  });

  it("can drop a waiting save without sending it", async () => {
    const { client, state } = flakyClient();
    state.online = true;
    const saver = createCloudSaver(client, "u1", "football", () => {});
    saver.save({ ...empty, done: ["root"] });
    saver.discard();
    await saver.flush();
    expect(state.saved).toEqual([]);
  });
});
