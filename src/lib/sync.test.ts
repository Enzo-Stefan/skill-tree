import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { football } from "../data/football";
import type { SavedProgress } from "./cloud";
import { hasUnsavedChanges, loadAccountProgress, markSyncedHere, sameProgress, setUnsavedChanges, shouldMerge } from "./sync";

describe("when to merge instead of letting the account win", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });

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
