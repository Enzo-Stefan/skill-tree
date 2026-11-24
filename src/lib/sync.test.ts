import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { football } from "../data/football";
import { weights } from "../data/weights";
import type { SavedProgress } from "./cloud";
import {
  hasUnsavedChanges,
  liftsSyncedHere,
  loadAccountCopy,
  loadAccountProgress,
  markSyncedHere,
  rebaseProgress,
  sameProgress,
  saveAccountCopy,
  setUnsavedChanges,
  shouldMerge,
} from "./sync";

const realStorage = globalThis.localStorage;
afterAll(() => {
  globalThis.localStorage = realStorage;
});

const store = new Map<string, string>();
function memoryStorage() {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
}

describe("when to merge instead of letting the account win", () => {
  beforeEach(memoryStorage);

  it("merges the first time an account is used in this browser", () => {
    expect(shouldMerge("football", "u1")).toBe(true);
  });

  it("lets the account win once synced, with nothing unsaved", () => {
    markSyncedHere("football", "u1");
    expect(shouldMerge("football", "u1")).toBe(false);
  });

  it("merges again while the browser has unsaved changes (offline, failed save, signed out)", () => {
    markSyncedHere("football", "u1");
    setUnsavedChanges("football", true);
    expect(shouldMerge("football", "u1")).toBe(true);
    setUnsavedChanges("football", false);
    expect(shouldMerge("football", "u1")).toBe(false);
  });

  it("merges for a different account on the same browser", () => {
    markSyncedHere("football", "u1");
    expect(shouldMerge("football", "u2")).toBe(true);
  });

  it("keeps the flag per tree", () => {
    setUnsavedChanges("football", true);
    expect(hasUnsavedChanges("football")).toBe(true);
    expect(hasUnsavedChanges("weights")).toBe(false);
  });

  it("merges to be safe when the browser's storage can't be read", () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(hasUnsavedChanges("football")).toBe(true);
  });
});

const empty: SavedProgress = { done: [], playerLevel: null, playerStep: 1, practiceDays: [], streak: { since: null, askedWeek: null } };

/** A stand-in for the Supabase client: one stored row, and a record of what was saved. */
function fakeClient(row: object | null) {
  const upserts: Record<string, unknown>[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
    upsert: async (value: Record<string, unknown>) => {
      upserts.push(value);
      return { error: null };
    },
  };
  return { client: { from: () => query } as unknown as SupabaseClient, upserts };
}

const accountRow = {
  done: ["root", "ps1"],
  player_level: "intermediate",
  player_step: 3,
  practice_days: ["2026-11-16"],
  streak_since: "2026-11-09",
  streak_asked_week: null,
};
const browser: SavedProgress = { ...empty, done: ["root", "bc1"], playerLevel: "beginner", practiceDays: ["2026-11-18"] };

describe("loadAccountProgress", () => {
  it("first time in this browser: merges both and saves the result to the account", async () => {
    const { client, upserts } = fakeClient(accountRow);
    const p = await loadAccountProgress(client, "u1", football, browser, true);
    expect(p.done.sort()).toEqual(["bc1", "ps1", "root"]);
    expect(p.practiceDays).toEqual(["2026-11-16", "2026-11-18"]);
    expect(p.playerLevel).toBe("intermediate");
    expect(p.playerStep).toBe(3);
    expect(upserts).toHaveLength(1);
  });

  it("after that: the account wins, so a skill un-ticked on another device stays un-ticked", async () => {
    const { client, upserts } = fakeClient(accountRow);
    const p = await loadAccountProgress(client, "u1", football, browser, false);
    expect(p.done.sort()).toEqual(["ps1", "root"]);
    expect(p.practiceDays).toEqual(["2026-11-16"]);
    expect(p.playerLevel).toBe("intermediate");
    expect(upserts).toHaveLength(0);
  });

  it("after that, with no row in the account: saves the browser's progress to it", async () => {
    const { client, upserts } = fakeClient(null);
    const p = await loadAccountProgress(client, "u1", football, browser, false);
    expect([...p.done].sort()).toEqual(["bc1", "root"]);
    expect(upserts[0]).toMatchObject({ user_id: "u1", done: ["root", "bc1"], player_level: "beginner" });
  });

  it("drops skills the tree no longer has from the account's copy", async () => {
    const { client } = fakeClient({ ...accountRow, done: ["root", "gone"] });
    expect((await loadAccountProgress(client, "u1", football, browser, false)).done).toEqual(["root"]);
  });
});

describe("sameProgress", () => {
  it("ignores the order of skills and days", () => {
    expect(sameProgress({ ...empty, done: ["a", "b"], practiceDays: ["2", "1"] }, { ...empty, done: ["b", "a"], practiceDays: ["1", "2"] })).toBe(true);
  });

  it("notices a different step", () => {
    expect(sameProgress({ ...empty, playerStep: 2 }, { ...empty, playerStep: 3 })).toBe(false);
  });
});

describe("rebaseProgress", () => {
  const base: SavedProgress = { ...empty, done: ["root", "ps1", "bc1"], practiceDays: ["2026-11-16", "2026-11-17"] };

  it("keeps an un-tick made here, and a tick made on another device", () => {
    const account = { ...base, done: [...base.done, "ps2"] };
    const local = { ...base, done: ["root", "bc1"] };
    expect(rebaseProgress(football, account, base, local).done.sort()).toEqual(["bc1", "ps2", "root"]);
  });

  it("doesn't bring back a skill un-ticked on another device", () => {
    const account = { ...base, done: ["root", "bc1"] };
    const local = { ...base, done: [...base.done, "ps2"] };
    expect(rebaseProgress(football, account, base, local).done.sort()).toEqual(["bc1", "ps2", "root"]);
  });

  it("a reset made here clears everything the account had at the time", () => {
    const account = { ...base, done: [...base.done, "ps2"] };
    const local = { ...base, done: [] };
    expect(rebaseProgress(football, account, base, local).done).toEqual(["ps2"]);
  });

  it("replays training days the same way", () => {
    const account = { ...base, practiceDays: ["2026-11-16", "2026-11-17", "2026-11-19"] };
    const local = { ...base, practiceDays: ["2026-11-16", "2026-11-18"] };
    expect(rebaseProgress(football, account, base, local).practiceDays).toEqual(["2026-11-16", "2026-11-18", "2026-11-19"]);
  });

  it("takes level, step and streak from here only if they changed here", () => {
    const withLevel = { ...base, playerLevel: "beginner", playerStep: 2, streak: { since: "2026-11-09", askedWeek: null } };
    const account = { ...withLevel, playerLevel: "intermediate", playerStep: 1 };
    expect(rebaseProgress(football, account, withLevel, withLevel).playerLevel).toBe("intermediate");
    const local = { ...withLevel, playerStep: 3, streak: { since: "2026-11-16", askedWeek: null } };
    const r = rebaseProgress(football, account, withLevel, local);
    expect([r.playerLevel, r.playerStep, r.streak.since]).toEqual(["beginner", 3, "2026-11-16"]);
  });

  it("with no account row, uses this browser's progress", () => {
    expect(rebaseProgress(football, null, base, { ...base, done: ["root"] }).done).toEqual(["root"]);
  });
});

describe("account copy in the browser", () => {
  beforeEach(memoryStorage);

  it("is kept per account", () => {
    saveAccountCopy("football", "u1", { ...empty, done: ["root"] });
    expect(loadAccountCopy("football", "u1")?.done).toEqual(["root"]);
    expect(loadAccountCopy("football", "u2")).toBeNull();
  });

  it("ignores a broken value", () => {
    store.set("skill-tree:football:account-copy", "{not json");
    expect(loadAccountCopy("football", "u1")).toBeNull();
  });

  it("an offline un-tick sticks on the next load", async () => {
    const accountCopy: SavedProgress = { ...empty, done: ["root", "ps1"] };
    const { client, upserts } = fakeClient({ ...accountRow, done: ["root", "ps1"], player_level: null });
    const local = { ...empty, done: ["root"] };
    const p = await loadAccountProgress(client, "u1", football, local, true, accountCopy);
    expect(p.done).toEqual(["root"]);
    expect(upserts[0]).toMatchObject({ done: ["root"] });
  });
});

describe("lift log when syncing", () => {
  const squat = (date: string, kg: number) => ({ skillId: "lg1", date, kg });

  it("rebases lift entries like skills: logged here is added, undone here is removed", () => {
    const base = { ...empty, liftLog: [squat("2026-11-18", 40), squat("2026-11-19", 400)] };
    const account = { ...base, liftLog: [...base.liftLog, squat("2026-11-21", 50)] };
    const local = { ...base, liftLog: [squat("2026-11-18", 40), squat("2026-11-22", 45)] };
    expect(rebaseProgress(weights, account, base, local).liftLog).toEqual([
      squat("2026-11-18", 40),
      squat("2026-11-21", 50),
      squat("2026-11-22", 45),
    ]);
  });

  it("treats an account copy saved before lifts were synced as having none", () => {
    const oldBase = { ...empty };
    const account = { ...empty, liftLog: [squat("2026-11-21", 50)] };
    const local = { ...empty, liftLog: [squat("2026-11-22", 45)] };
    expect(rebaseProgress(weights, account, oldBase, local).liftLog).toEqual([squat("2026-11-21", 50), squat("2026-11-22", 45)]);
  });

  it("sees a missing lift log and an empty one as the same, and notices a new entry", () => {
    expect(sameProgress(empty, { ...empty, liftLog: [] })).toBe(true);
    expect(sameProgress({ ...empty, liftLog: [squat("2026-11-20", 40)] }, empty)).toBe(false);
  });
});

describe("upgrading a browser that synced before lifts were kept", () => {
  beforeEach(memoryStorage);

  it("merges once, then lets the account win again", () => {
    // Synced with an older version: only the account marker is set.
    store.set("skill-tree:weights:synced-account", "u1");
    expect(liftsSyncedHere("weights", "u1")).toBe(false);
    expect(shouldMerge("weights", "u1")).toBe(true);
    markSyncedHere("weights", "u1");
    expect(liftsSyncedHere("weights", "u1")).toBe(true);
    expect(shouldMerge("weights", "u1")).toBe(false);
  });

  it("uploads the lifts saved here instead of taking the account's empty log", async () => {
    store.set("skill-tree:weights:synced-account", "u1");
    const squat = { skillId: "lg1", date: "2026-11-20", kg: 40 };
    // The account copy this browser kept from before has no lift log; the account's new column is empty.
    const base = { ...empty };
    const row = { done: [], player_level: null, player_step: 1, practice_days: [], streak_since: null, streak_asked_week: null, lift_log: [] };
    const upserts: unknown[] = [];
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: row, error: null }),
      upsert: async (value: unknown) => {
        upserts.push(value);
        return { error: null };
      },
    };
    const client = { from: () => query } as unknown as SupabaseClient;
    const local = { ...empty, liftLog: [squat] };
    const loaded = await loadAccountProgress(client, "u1", weights, local, shouldMerge("weights", "u1"), base);
    expect(loaded.liftLog).toEqual([squat]);
    expect(upserts[0]).toMatchObject({ lift_log: [squat] });
  });
});
