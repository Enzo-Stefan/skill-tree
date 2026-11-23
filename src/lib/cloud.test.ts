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

const empty: SavedProgress = { done: [], playerLevel: null, levelCheckpoint: null };

describe("mergeProgress (first sign-in on a device)", () => {
  it("keeps finished skills from both the browser and the account", () => {
    const local = { ...empty, done: ["root", "bc1"] };
    const cloud = { ...empty, done: ["root", "ps1"] };
    expect(mergeProgress(football, local, cloud).done.sort()).toEqual(["bc1", "ps1", "root"]);
  });

  it("uses the browser's progress when the account is new", () => {
    const local = { done: ["root"], playerLevel: "advanced", levelCheckpoint: 1 };
    expect(mergeProgress(football, local, null)).toEqual(local);
  });

  it("keeps the account's level over the browser's", () => {
    const local = { done: ["root"], playerLevel: "beginner", levelCheckpoint: 1 };
    const cloud = { done: ["root"], playerLevel: "expert", levelCheckpoint: 0 };
    const merged = mergeProgress(football, local, cloud);
    expect(merged.playerLevel).toBe("expert");
    expect(merged.levelCheckpoint).toBe(0);
  });

  it("takes the browser's level when the account has none", () => {
    const local = { done: [], playerLevel: "intermediate", levelCheckpoint: 0 };
    expect(mergeProgress(football, local, empty).playerLevel).toBe("intermediate");
  });
});

describe("cleanProgress (old or broken saves)", () => {
  it("drops skills and levels the tree no longer has", () => {
    const cleaned = cleanProgress(football, { done: ["root", "gone", "root"], playerLevel: "legend", levelCheckpoint: 4 });
    expect(cleaned).toEqual({ done: ["root"], playerLevel: null, levelCheckpoint: null });
  });

  it("never lets the checkpoint be above the number of finished skills", () => {
    expect(cleanProgress(football, { done: ["root"], playerLevel: "beginner", levelCheckpoint: 9 }).levelCheckpoint).toBe(1);
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

describe("loading and saving", () => {
  it("reads a saved row", async () => {
    const { client } = fakeClient({ done: ["root"], player_level: "expert", level_checkpoint: 1 });
    expect(await fetchCloudProgress(client, "u1", "football")).toEqual({
      done: ["root"],
      playerLevel: "expert",
      levelCheckpoint: 1,
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
    const { client, upserts } = fakeClient({ done: ["ps1"], player_level: null, level_checkpoint: null });
    const local = { done: ["root"], playerLevel: "beginner", levelCheckpoint: 0 };
    const merged = await syncOnSignIn(client, "u1", football, local);
    expect(merged.done.sort()).toEqual(["ps1", "root"]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ user_id: "u1", tree_id: "football", player_level: "beginner" });
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

  it("reports a failed save instead of crashing", async () => {
    const errors: string[] = [];
    const saver = createCloudSaver(fakeClient(null, { message: "offline" }).client, "u1", "football", (m) => errors.push(m));
    saver.save(empty);
    await saver.flush();
    expect(errors).toEqual(["Couldn't save your progress: offline"]);
  });
});
