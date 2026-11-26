// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { football } from "../data/football";
import type { SavedProgress } from "./cloud";
import { emptyProgress } from "./cloud";
import { belongsToAnother, getOwner, setOwner } from "./localOwner";
import { belongsToOtherAccount, forgetOtherAccount, markSyncedHere, setUnsavedChanges, syncedAccount } from "./sync";
import { useCloudSync } from "./useCloudSync";

// Two accounts on one browser (#139): the second account must start from its own data, never from what the first
// left behind. Supabase is faked with one saved row per account; browser storage is the one jsdom localStorage.

const rows = new Map<string, Record<string, unknown>>();
const failing = { current: false };
const fakeClient = {
  from: () => {
    let user = "";
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        if (column === "user_id") user = value;
        return query;
      },
      maybeSingle: async () => (failing.current ? { data: null, error: { message: "offline" } } : { data: rows.get(user) ?? null, error: null }),
      upsert: async (value: Record<string, unknown>) => {
        rows.set(value.user_id as string, value);
        return { error: null };
      },
    };
    return query;
  },
};
vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => fakeClient) }));

const T = football.id;
const toRow = (userId: string, p: Partial<SavedProgress>) => {
  const full = { ...emptyProgress(), ...p };
  return {
    user_id: userId,
    tree_id: T,
    done: full.done,
    player_level: full.playerLevel,
    player_step: full.playerStep,
    practice_days: full.practiceDays,
    streak_since: full.streak.since,
    streak_asked_week: full.streak.askedWeek,
    lift_log: full.liftLog,
    results: full.results,
    sessions: full.sessions,
  };
};
const savedDone = (userId: string) => [...((rows.get(userId)?.done as string[]) ?? [])].sort();
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(900)));

/** The app on this browser: signed in as `userId` (or not), holding `progress`; loaded progress replaces it, like the app does. */
function openApp(userId: string | null, progress: SavedProgress) {
  let current = { userId, progress };
  const apply = vi.fn((p: SavedProgress) => {
    current = { ...current, progress: p };
    act(() => hook.rerender(current));
  });
  const hook = renderHook((props: { userId: string | null; progress: SavedProgress }) => useCloudSync({ tree: football, ...props, apply, onMessage: vi.fn() }), { initialProps: current });
  return { ...hook, apply, shown: () => current.progress, signIn: (id: string | null) => { current = { ...current, userId: id }; hook.rerender(current); } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  rows.clear();
  failing.current = false;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const A_PROGRESS: SavedProgress = { ...emptyProgress(), done: ["root", "bc1", "bc2"], playerLevel: "advanced", playerStep: 3, practiceDays: ["2026-11-20", "2026-11-21"] };

describe("a different account signs in on the same browser", () => {
  it("shows only the new account's own progress and saves nothing of the first account's into it", async () => {
    rows.set("A", toRow("A", A_PROGRESS));
    rows.set("B", toRow("B", { done: ["root"], playerLevel: "beginner", playerStep: 1 }));
    // A used this browser and signed out.
    const a = openApp("A", emptyProgress());
    await flush();
    expect([...a.shown().done].sort()).toEqual(["bc1", "bc2", "root"]);
    a.unmount();
    expect(syncedAccount(T)).toBe("A");

    // B signs in on the same browser, which still holds A's progress.
    const b = openApp("B", A_PROGRESS);
    await flush();
    expect([...b.shown().done]).toEqual(["root"]);
    expect(b.shown().playerLevel).toBe("beginner");
    expect(b.shown().practiceDays).toEqual([]);
    expect(savedDone("B")).toEqual(["root"]);
    expect(savedDone("A")).toEqual(["bc1", "bc2", "root"]);
    expect(syncedAccount(T)).toBe("B");
  });

  it("gives a brand new account an empty start, not the first account's progress", async () => {
    rows.set("A", toRow("A", A_PROGRESS));
    const a = openApp("A", emptyProgress());
    await flush();
    a.unmount();
    const b = openApp("B", A_PROGRESS);
    await flush();
    expect(b.shown().done).toEqual([]);
    expect(savedDone("B")).toEqual([]);
    expect(rows.get("B")?.player_level).toBeNull();
  });

  it("does not carry the first account's unsaved changes over", async () => {
    rows.set("A", toRow("A", { done: ["root"] }));
    rows.set("B", toRow("B", { done: ["root"] }));
    markSyncedHere(T, "A");
    setUnsavedChanges(T, true);
    const b = openApp("B", { ...emptyProgress(), done: ["root", "bc1", "bc2", "bc3"] });
    await flush();
    expect([...b.shown().done]).toEqual(["root"]);
    expect(savedDone("B")).toEqual(["root"]);
  });

  it("does not let the first account's progress leak in when the new account's first load fails and is retried (#139 review)", async () => {
    rows.set("A", toRow("A", A_PROGRESS));
    rows.set("B", toRow("B", { done: ["root"] }));
    const a = openApp("A", emptyProgress());
    await flush();
    a.unmount();
    expect(syncedAccount(T)).toBe("A");

    // B signs in on the same browser while it is offline: the load fails.
    failing.current = true;
    const b = openApp("B", A_PROGRESS);
    await flush();
    expect(b.result.current.status).toBe("error");
    expect(b.apply).not.toHaveBeenCalled();
    // The marker still names A, so the retry is still treated as foreign.
    expect(syncedAccount(T)).toBe("A");
    expect(savedDone("B")).toEqual(["root"]);

    // The connection comes back and the load is retried.
    failing.current = false;
    act(() => void window.dispatchEvent(new Event("online")));
    await flush();
    expect(b.result.current.status).toBe("ready");
    expect([...b.shown().done]).toEqual(["root"]);
    expect(savedDone("B")).toEqual(["root"]);
    expect(syncedAccount(T)).toBe("B");
  });

  it("keeps the XP and rating owner handoff for after a failed first load too", async () => {
    rows.set("B", toRow("B", { done: ["root"] }));
    markSyncedHere(T, "A");
    failing.current = true;
    const b = openApp("B", { ...emptyProgress(), done: ["root", "bc1"] });
    await flush();
    expect(b.result.current.status).toBe("error");
    expect(getOwner(T, "xp")).toBeNull();
    failing.current = false;
    act(() => void window.dispatchEvent(new Event("online")));
    await flush();
    expect(getOwner(T, "xp")).toBe("A");
    expect(syncedAccount(T)).toBe("B");
  });

  it("lets the first account sign back in and get its own data again", async () => {
    rows.set("A", toRow("A", A_PROGRESS));
    rows.set("B", toRow("B", { done: ["root"] }));
    openApp("A", emptyProgress());
    await flush();
    cleanup();
    openApp("B", A_PROGRESS);
    await flush();
    cleanup();
    const again = openApp("A", { ...emptyProgress(), done: ["root"] });
    await flush();
    expect([...again.shown().done].sort()).toEqual(["bc1", "bc2", "root"]);
    expect(savedDone("B")).toEqual(["root"]);
  });
});

describe("what does not change", () => {
  it("still merges a guest's progress on first sign-in, because no account ever synced here", async () => {
    rows.set("B", toRow("B", { done: ["root"] }));
    expect(syncedAccount(T)).toBeNull();
    const b = openApp("B", { ...emptyProgress(), done: ["root", "bc1"] });
    await flush();
    expect([...b.shown().done].sort()).toEqual(["bc1", "root"]);
    expect(savedDone("B")).toEqual(["bc1", "root"]);
  });

  it("keeps working normally when the same account signs in again", async () => {
    rows.set("A", toRow("A", { done: ["root"] }));
    openApp("A", emptyProgress());
    await flush();
    cleanup();
    const again = openApp("A", { ...emptyProgress(), done: ["root", "bc1"] });
    await flush();
    expect(belongsToOtherAccount(T, "A")).toBe(false);
    expect(again.result.current.status).toBe("ready");
  });
});

describe("the owner markers", () => {
  it("a guest has no other account, a different id is another account, the same id is not", () => {
    expect(belongsToOtherAccount(T, "A")).toBe(false);
    markSyncedHere(T, "A");
    expect(belongsToOtherAccount(T, "A")).toBe(false);
    expect(belongsToOtherAccount(T, "B")).toBe(true);
    forgetOtherAccount(T);
    expect(syncedAccount(T)).toBeNull();
    expect(belongsToOtherAccount(T, "B")).toBe(false);
  });

  it("the XP and rating markers work the same way", () => {
    expect(belongsToAnother(T, "xp", "A")).toBe(false);
    setOwner(T, "xp", "A");
    expect(getOwner(T, "xp")).toBe("A");
    expect(belongsToAnother(T, "xp", "A")).toBe(false);
    expect(belongsToAnother(T, "xp", "B")).toBe(true);
    expect(belongsToAnother(T, "ratings", "B")).toBe(false);
  });

  it("when progress knew the old account, the XP and rating copies are handed to it before they are cleared", async () => {
    rows.set("B", toRow("B", { done: ["root"] }));
    markSyncedHere(T, "A");
    openApp("B", { ...emptyProgress(), done: ["root", "bc1"] });
    await flush();
    expect(getOwner(T, "xp")).toBe("A");
    expect(getOwner(T, "ratings")).toBe("A");
  });
});
