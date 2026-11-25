// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { football } from "../data/football";
import type { SavedProgress } from "./cloud";
import { hasUnsavedChanges } from "./sync";
import { useCloudSync } from "./useCloudSync";

// Real flows through the real hook (useCloudSync + sync.ts + cloud.ts), with only Supabase faked:
// one shared "account row" that every simulated device reads and writes, and a switch for the
// connection. Each device keeps its own browser storage (switchToDevice/leaveDevice). Timers are fake,
// so a save's 800 ms wait costs nothing.

const row: { current: Record<string, unknown> | null } = { current: null };
const online = { current: true };
const upserts: Record<string, unknown>[] = [];

const fakeClient = {
  from: () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => (online.current ? { data: row.current, error: null } : { data: null, error: { message: "offline" } }),
      upsert: async (value: Record<string, unknown>) => {
        if (!online.current) return { error: { message: "offline" } };
        row.current = value;
        upserts.push(value);
        return { error: null };
      },
    };
    return query;
  },
};
vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => fakeClient) }));

const noStreak = { since: null, askedWeek: null };
const empty: SavedProgress = { done: [], playerLevel: null, playerStep: 1, practiceDays: [], streak: noStreak, liftLog: [], results: [], sessions: [] };
const T = football.id;

function toRow(p: SavedProgress) {
  return {
    user_id: "u1",
    tree_id: T,
    done: p.done,
    player_level: p.playerLevel,
    player_step: p.playerStep,
    practice_days: p.practiceDays,
    streak_since: p.streak.since,
    streak_asked_week: p.streak.askedWeek,
    lift_log: p.liftLog ?? [],
    results: p.results ?? [],
    sessions: p.sessions ?? [],
  };
}
const accountDone = () => [...((row.current?.done as string[]) ?? [])].sort();
const accountDays = () => (row.current?.practice_days as string[]) ?? [];

/** Browser storage of each simulated device, swapped in and out of jsdom's one localStorage. */
const devices = new Map<string, Record<string, string>>();
function switchToDevice(name: string) {
  localStorage.clear();
  for (const [k, v] of Object.entries(devices.get(name) ?? {})) localStorage.setItem(k, v);
}
function leaveDevice(name: string) {
  const copy: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) copy[localStorage.key(i)!] = localStorage.getItem(localStorage.key(i)!)!;
  devices.set(name, copy);
}

const flushTimers = (ms = 900) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

/** Opens the app on a device: signed in (or not) with the progress it holds. */
function openApp(userId: string | null, progress: SavedProgress) {
  const onMessage = vi.fn();
  let current = { userId, progress };
  // Like the app: progress loaded from the account becomes the progress the hook sees.
  const apply = vi.fn((p: SavedProgress) => {
    current = { ...current, progress: p };
    act(() => hook.rerender(current));
  });
  const hook = renderHook((props: { userId: string | null; progress: SavedProgress }) => useCloudSync({ tree: football, ...props, apply, onMessage }), {
    initialProps: current,
  });
  return {
    ...hook,
    apply,
    onMessage,
    rerender: (next: { userId: string | null; progress: SavedProgress }) => {
      current = next;
      hook.rerender(next);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  row.current = null;
  online.current = true;
  upserts.length = 0;
  devices.clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sign-in on a new device", () => {
  it("shows the account's progress and doesn't change it", async () => {
    row.current = toRow({ ...empty, done: ["root", "ps1"], playerLevel: "intermediate", playerStep: 2, practiceDays: ["2026-11-16"] });
    const app = openApp("u1", empty);
    await flushTimers();
    expect(app.result.current.status).toBe("ready");
    const shown = app.apply.mock.calls[0][0] as SavedProgress;
    expect([...shown.done].sort()).toEqual(["ps1", "root"]);
    expect(shown.playerLevel).toBe("intermediate");
    expect(accountDone()).toEqual(["ps1", "root"]);
    expect(hasUnsavedChanges(T)).toBe(false);
  });

  it("a failed load shows an error and sends nothing, so an empty device can't wipe the account", async () => {
    row.current = toRow({ ...empty, done: ["root", "ps1"] });
    online.current = false;
    const app = openApp("u1", empty);
    await flushTimers();
    expect(app.result.current.status).toBe("error");
    expect(app.apply).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
    expect(accountDone()).toEqual(["ps1", "root"]);
  });

  it("loads again when the connection comes back", async () => {
    row.current = toRow({ ...empty, done: ["root"] });
    online.current = false;
    const app = openApp("u1", empty);
    await flushTimers();
    online.current = true;
    act(() => void window.dispatchEvent(new Event("online")));
    await flushTimers();
    expect(app.result.current.status).toBe("ready");
  });
});

describe("two devices editing offline, then syncing", () => {
  /** Devices A and B both signed in and in sync on {root, ps1}. */
  async function bothSynced() {
    const base = { ...empty, done: ["root", "ps1"], playerLevel: "beginner" };
    row.current = toRow(base);
    for (const d of ["A", "B"]) {
      switchToDevice(d);
      const app = openApp("u1", base);
      await flushTimers();
      app.unmount();
      leaveDevice(d);
    }
    return base;
  }

  /** The device is offline: opens the app, makes `edit`, and closes the app. */
  async function editOffline(device: string, base: SavedProgress, edit: SavedProgress) {
    switchToDevice(device);
    const app = openApp("u1", base);
    await flushTimers();
    app.rerender({ userId: "u1", progress: edit });
    await flushTimers();
    expect(hasUnsavedChanges(T)).toBe(true);
    app.unmount();
    leaveDevice(device);
  }

  async function openAndSync(device: string, progress: SavedProgress) {
    switchToDevice(device);
    const app = openApp("u1", progress);
    await flushTimers();
    return app;
  }

  it("keeps A's un-tick and B's new skill, and loses neither", async () => {
    const base = await bothSynced();
    online.current = false;
    const aEdit = { ...base, done: ["root"] };
    const bEdit = { ...base, done: ["root", "ps1", "bc1"], practiceDays: ["2026-11-18"] };
    await editOffline("A", base, aEdit);
    await editOffline("B", base, bEdit);

    online.current = true;
    const a = await openAndSync("A", aEdit);
    expect(accountDone()).toEqual(["root"]);
    a.unmount();
    leaveDevice("A");

    const b = await openAndSync("B", bEdit);
    expect(accountDone()).toEqual(["bc1", "root"]);
    expect(accountDays()).toEqual(["2026-11-18"]);
    const shown = b.apply.mock.calls.at(-1)![0] as SavedProgress;
    expect([...shown.done].sort()).toEqual(["bc1", "root"]);
    expect(hasUnsavedChanges(T)).toBe(false);
  });

  it("both devices ticking different skills offline end up with both, whoever syncs first", async () => {
    const base = await bothSynced();
    online.current = false;
    const aEdit = { ...base, done: ["root", "ps1", "bc1"] };
    const bEdit = { ...base, done: ["root", "ps1", "ps2"] };
    await editOffline("A", base, aEdit);
    await editOffline("B", base, bEdit);
    online.current = true;
    (await openAndSync("B", bEdit)).unmount();
    leaveDevice("B");
    (await openAndSync("A", aEdit)).unmount();
    expect(accountDone()).toEqual(["bc1", "ps1", "ps2", "root"]);
  });

  it("a save that failed offline goes out by itself when the connection returns", async () => {
    const base = await bothSynced();
    switchToDevice("A");
    const a = openApp("u1", base);
    await flushTimers();
    online.current = false;
    a.rerender({ userId: "u1", progress: { ...base, done: ["root", "ps1", "bc1"] } });
    await flushTimers();
    expect(a.onMessage).toHaveBeenCalled();
    expect(accountDone()).toEqual(["ps1", "root"]);
    expect(hasUnsavedChanges(T)).toBe(true);
    online.current = true;
    act(() => void window.dispatchEvent(new Event("online")));
    await flushTimers();
    expect(accountDone()).toEqual(["bc1", "ps1", "root"]);
    expect(hasUnsavedChanges(T)).toBe(false);
  });
});

describe("signing out while a save is pending", () => {
  const start = { ...empty, done: ["root"] };
  const edited = { ...empty, done: ["root", "ps1"] };

  it("flush() before sign-out sends the waiting change", async () => {
    row.current = toRow(start);
    const app = openApp("u1", start);
    await flushTimers();
    app.rerender({ userId: "u1", progress: edited });
    await flushTimers(10); // under the 800 ms wait: still pending
    expect(accountDone()).toEqual(["root"]);
    await act(async () => void (await app.result.current.flush()));
    expect(accountDone()).toEqual(["ps1", "root"]);
  });

  it("even without flush(), ending the session sends the waiting change", async () => {
    row.current = toRow(start);
    const app = openApp("u1", start);
    await flushTimers();
    app.rerender({ userId: "u1", progress: edited });
    await flushTimers(10);
    app.rerender({ userId: null, progress: edited });
    await flushTimers();
    expect(accountDone()).toEqual(["ps1", "root"]);
    expect(app.result.current.status).toBe("off");
  });

  it("offline sign-out keeps the change marked unsaved, and it reaches the account on the next sign-in", async () => {
    row.current = toRow(start);
    const app = openApp("u1", start);
    await flushTimers();
    online.current = false;
    app.rerender({ userId: "u1", progress: edited });
    await act(async () => void (await app.result.current.flush()));
    app.rerender({ userId: null, progress: edited });
    await flushTimers();
    expect(hasUnsavedChanges(T)).toBe(true);
    expect(accountDone()).toEqual(["root"]);
    app.unmount();
    online.current = true;
    const again = openApp("u1", edited);
    await flushTimers();
    expect(accountDone()).toEqual(["ps1", "root"]);
    expect(again.result.current.status).toBe("ready");
    expect(hasUnsavedChanges(T)).toBe(false);
  });

  it("progress made while signed out is merged in at the next sign-in, not dropped", async () => {
    row.current = toRow({ ...empty, done: ["root", "ps1"] });
    const first = openApp("u1", { ...empty, done: ["root", "ps1"] });
    await flushTimers();
    first.rerender({ userId: null, progress: { ...empty, done: ["root", "ps1"] } });
    await flushTimers();
    const signedOut = { ...empty, done: ["root", "ps1", "bc1"] };
    first.rerender({ userId: null, progress: signedOut });
    await flushTimers();
    expect(hasUnsavedChanges(T)).toBe(true);
    first.unmount();
    const again = openApp("u1", signedOut);
    await flushTimers();
    expect(accountDone()).toEqual(["bc1", "ps1", "root"]);
    expect(again.apply).toHaveBeenCalled();
  });
});

describe("guest progress on the first sign-in", () => {
  const guest: SavedProgress = {
    ...empty,
    done: ["root", "bc1"],
    playerLevel: "beginner",
    playerStep: 2,
    practiceDays: ["2026-11-18"],
  };

  it("with a brand-new account, the guest's progress becomes the account's", async () => {
    const app = openApp("u1", guest);
    await flushTimers();
    expect(accountDone()).toEqual(["bc1", "root"]);
    expect(row.current).toMatchObject({ player_level: "beginner", player_step: 2, practice_days: ["2026-11-18"] });
    expect(hasUnsavedChanges(T)).toBe(false);
    expect(app.onMessage).toHaveBeenCalled(); // the "signed in" message
  });

  it("with an account that has progress, finished skills and days from both are kept", async () => {
    row.current = toRow({ ...empty, done: ["root", "ps1"], practiceDays: ["2026-11-16"] });
    const app = openApp("u1", guest);
    await flushTimers();
    expect(accountDone()).toEqual(["bc1", "ps1", "root"]);
    expect(accountDays()).toEqual(["2026-11-16", "2026-11-18"]);
    const shown = app.apply.mock.calls.at(-1)![0] as SavedProgress;
    expect([...shown.done].sort()).toEqual(["bc1", "ps1", "root"]);
    // The account had no level, so the guest's level and step carry over.
    expect(shown.playerLevel).toBe("beginner");
    expect(shown.playerStep).toBe(2);
  });

  it("when both chose a level, the account's wins (the guest's level and step are not merged)", async () => {
    row.current = toRow({ ...empty, done: ["root"], playerLevel: "expert", playerStep: 3 });
    openApp("u1", guest);
    await flushTimers();
    expect(row.current).toMatchObject({ player_level: "expert", player_step: 3 });
    expect(accountDone()).toEqual(["bc1", "root"]);
  });

  it("the guest's copy is merged only once: a skill removed on another device afterwards stays removed", async () => {
    row.current = toRow({ ...empty, done: ["root", "ps1"] });
    const first = openApp("u1", guest);
    await flushTimers();
    first.unmount();
    // Another device removes bc1 from the account.
    row.current = toRow({ ...empty, done: ["root", "ps1"], playerLevel: "beginner", playerStep: 2, practiceDays: ["2026-11-18"] });
    openApp("u1", { ...guest, done: ["root", "bc1", "ps1"] });
    await flushTimers();
    expect(accountDone()).toEqual(["ps1", "root"]);
  });
});
