// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Tree } from "../types";
import { XP_AMOUNTS } from "../data/xp";
import type { XpEvent } from "./xp";
import { fetchXp, pushXp } from "./xpSync";
import { useXp } from "./useXp";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({})) }));
vi.mock("./xpSync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./xpSync")>()),
  fetchXp: vi.fn(),
  pushXp: vi.fn(),
}));

const tree = { id: "football", branches: [], skills: [{ id: "a" }, { id: "b" }] } as unknown as Tree;
const T0 = "2026-11-20T10:00:00.000Z";
/** What one passed skill earns: the pass itself and the bronze mastery that comes with it. */
const PASS = XP_AMOUNTS.skill + XP_AMOUNTS.mastery.bronze;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchXp).mockReset().mockResolvedValue([]);
  vi.mocked(pushXp).mockReset().mockResolvedValue();
});
afterEach(cleanup);

describe("useXp", () => {
  it("works out XP from the finished skills and training days, signed out", () => {
    const { result } = renderHook(() => useXp(tree, null, "off", new Set(["a"]), ["2026-11-25"]));
    expect(result.current.total).toBe(PASS + XP_AMOUNTS.session);
    expect(result.current.level.level).toBe(2);
    expect(fetchXp).not.toHaveBeenCalled();
  });

  it("awards and takes away nothing while the account's progress is still loading", () => {
    localStorage.setItem("skill-tree:football:xp", JSON.stringify([{ key: "skill:a:pass", xp: 100, active: true, at: T0 }]));
    const { result } = renderHook(() => useXp(tree, "u1", "loading", new Set<string>(), []));
    expect(result.current.total).toBe(100);
  });

  it("removes the XP when a skill is un-ticked", () => {
    const { result, rerender } = renderHook(({ done }) => useXp(tree, null, "off", done, []), { initialProps: { done: new Set(["a", "b"]) } });
    expect(result.current.total).toBe(2 * PASS);
    rerender({ done: new Set(["a"]) });
    expect(result.current.total).toBe(PASS);
  });

  it("merges the account's ledger once progress is ready, without paying twice, and sends the result", async () => {
    const fromAccount: XpEvent[] = [
      { key: "skill:a:pass", xp: 100, active: true, at: T0 },
      { key: "streak:4", xp: 200, active: true, at: T0 },
    ];
    vi.mocked(fetchXp).mockResolvedValue(fromAccount);
    const { result } = renderHook(() => useXp(tree, "u1", "ready", new Set(["a", "b"]), []));
    await waitFor(() => expect(pushXp).toHaveBeenCalled());
    expect(result.current.total).toBe(2 * PASS + 200);
    const sent = vi.mocked(pushXp).mock.calls[0]![2];
    expect(sent.filter((e) => e.key === "skill:a:pass")).toHaveLength(1);
  });

  it("keeps working from this browser's copy when the account calls fail", async () => {
    vi.mocked(fetchXp).mockRejectedValue(new Error("relation xp_events does not exist"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useXp(tree, "u1", "ready", new Set(["a"]), []));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current.total).toBe(PASS);
    expect(pushXp).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("saves a later change to the account after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { rerender } = renderHook(({ done }) => useXp(tree, "u1", "ready", done, []), { initialProps: { done: new Set(["a"]) } });
      await waitFor(() => expect(pushXp).toHaveBeenCalledTimes(1));
      rerender({ done: new Set(["a", "b"]) });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      expect(pushXp).toHaveBeenCalledTimes(2);
      expect(vi.mocked(pushXp).mock.calls[1]![2].some((e) => e.key === "skill:b:pass")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("earns achievements from progress, keeps them after an undo, and adds no XP for them", () => {
    const { result, rerender } = renderHook(({ done }) => useXp(tree, null, "off", done, [], { streakWeeks: 4, levelIndex: 1, results: 0 }), { initialProps: { done: new Set(["a"]) } });
    expect(result.current.earned).toEqual(expect.arrayContaining(["first-skill", "streak-4", "pick-level", "intermediate"]));
    // The skill, plus the 4-week streak bonus: the achievements themselves add nothing.
    expect(result.current.total).toBe(PASS + XP_AMOUNTS.streak[4]!);
    rerender({ done: new Set<string>() });
    expect(result.current.earned).toContain("first-skill");
    // The skill's XP goes with the undo; the streak bonus stays, because the milestone was reached.
    expect(result.current.total).toBe(XP_AMOUNTS.streak[4]);
  });

  it("pays a streak bonus once per run, and a new run (a different start week) pays again", () => {
    const { result, rerender } = renderHook(({ since }) => useXp(tree, null, "off", new Set<string>(), [], { streakWeeks: 4, streakSince: since, levelIndex: -1, results: 0 }), { initialProps: { since: null as string | null } });
    expect(result.current.total).toBe(XP_AMOUNTS.streak[4]);
    rerender({ since: null });
    expect(result.current.total).toBe(XP_AMOUNTS.streak[4]);
    rerender({ since: "2026-11-02" });
    expect(result.current.total).toBe(2 * XP_AMOUNTS.streak[4]!);
    expect(result.current.events.map((e) => e.key).filter((k) => k.startsWith("streak:")).sort()).toEqual(["streak:4:2026-11-02", "streak:4:start"]);
  });

  it("reset switches everything off, and a new streak after the reset earns its bonus again", () => {
    const { result, rerender } = renderHook(({ done, weeks }) => useXp(tree, null, "off", done, [], { streakWeeks: weeks, streakSince: null, levelIndex: -1, results: 0 }), {
      initialProps: { done: new Set(["a"]), weeks: 4 },
    });
    expect(result.current.total).toBe(PASS + XP_AMOUNTS.streak[4]!);
    // "Reset everything": progress and streak are cleared, then the ledger is switched off.
    rerender({ done: new Set<string>(), weeks: 0 });
    act(() => result.current.reset());
    expect(result.current.total).toBe(0);
    expect(result.current.earned).toEqual([]);
    // Four good weeks again: the same start-of-run key pays again, once.
    rerender({ done: new Set<string>(), weeks: 4 });
    expect(result.current.total).toBe(XP_AMOUNTS.streak[4]);
    rerender({ done: new Set<string>(), weeks: 4 });
    expect(result.current.total).toBe(XP_AMOUNTS.streak[4]);
  });

  it("pays a completed mission once, from the keys the app passes in", () => {
    const base = { streakWeeks: 0, levelIndex: -1, results: 0 };
    const { result, rerender } = renderHook(({ keys }) => useXp(tree, null, "off", new Set<string>(), [], { ...base, missionKeys: keys }), { initialProps: { keys: [] as string[] } });
    expect(result.current.total).toBe(0);
    rerender({ keys: ["mission:2026-11-26:a"] });
    expect(result.current.total).toBe(XP_AMOUNTS.mission);
    rerender({ keys: ["mission:2026-11-26:a"] });
    rerender({ keys: [] });
    expect(result.current.total).toBe(XP_AMOUNTS.mission);
  });

  it("pays today's challenge when it is done, and checks none when no day is given", () => {
    const days = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"];
    const sessions = ["a", "b", "c", "d"].map((skillId) => ({ date: "2026-11-26", skillId }));
    const base = { streakWeeks: 0, levelIndex: -1, results: 0, sessions };
    const without = renderHook(() => useXp(tree, null, "off", new Set<string>(), days, base));
    expect(without.result.current.events.some((e) => e.key.startsWith("challenge:"))).toBe(false);
    cleanup();
    localStorage.clear();
    const withDay = renderHook(() => useXp(tree, null, "off", new Set<string>(), days, { ...base, today: "2026-11-26" }));
    expect(withDay.result.current.events.some((e) => e.key.startsWith("challenge:"))).toBe(true);
  });

  it("a challenge that asks for a pass counts only passes recorded by day, never one the app merely noticed", () => {
    const days = ["2026-11-26"];
    const base = { streakWeeks: 0, levelIndex: -1, results: 0, today: "2026-11-26" };
    // A skill already done when the app loads (a legacy pass) gives no pass-day marker, so no pass goal is met by it.
    const legacy = renderHook(() => useXp(tree, null, "off", new Set(["a", "b"]), days, base));
    expect(legacy.result.current.events.some((e) => e.key.startsWith("passday:"))).toBe(false);
    cleanup();
    localStorage.clear();
    const fresh = renderHook(({ done }) => useXp(tree, null, "off", done, days, base), { initialProps: { done: new Set<string>() } });
    act(() => {
      fresh.result.current.recordPassDay("a", "2026-11-26");
      fresh.rerender({ done: new Set(["a"]) });
    });
    expect(fresh.result.current.events.some((e) => e.key === "passday:a:2026-11-26" && e.active)).toBe(true);
  });

  it("an undo and re-pass never moves a pass to a later day: only a skill's first-ever pass gets a day", () => {
    const base = { streakWeeks: 0, levelIndex: -1, results: 0 };
    const { result, rerender } = renderHook(({ done }) => useXp(tree, null, "off", done, [], base), { initialProps: { done: new Set<string>() } });
    act(() => {
      result.current.recordPassDay("a", "2026-11-24");
      rerender({ done: new Set(["a"]) });
    });
    const days = () => result.current.events.filter((e) => e.active && e.key.startsWith("passday:")).map((e) => e.key);
    expect(days()).toEqual(["passday:a:2026-11-24"]);
    // Undo, then pass again on a later day: no new day is written.
    rerender({ done: new Set<string>() });
    expect(days()).toEqual([]);
    act(() => {
      result.current.recordPassDay("a", "2026-11-26");
      rerender({ done: new Set(["a"]) });
    });
    expect(days()).toEqual([]);
  });

  it("a skill that was already passed when the app loaded never gets a day, even after an undo and re-pass", () => {
    const base = { streakWeeks: 0, levelIndex: -1, results: 0 };
    const { result, rerender } = renderHook(({ done }) => useXp(tree, null, "off", done, [], base), { initialProps: { done: new Set(["a"]) } });
    rerender({ done: new Set<string>() });
    act(() => {
      result.current.recordPassDay("a", "2026-11-26");
      rerender({ done: new Set(["a"]) });
    });
    expect(result.current.events.some((e) => e.key.startsWith("passday:"))).toBe(false);
  });

  it("Reset everything: the ticks and the ledger are cleared together, so today's mission is not paid again", () => {
    const base = { streakWeeks: 0, levelIndex: -1, results: 0 };
    const key = "mission:2026-11-26:a";
    const { result, rerender } = renderHook(({ done, keys }) => useXp(tree, null, "off", done, [], { ...base, missionKeys: keys }), { initialProps: { done: new Set(["a"]), keys: [key] } });
    expect(result.current.total).toBe(XP_AMOUNTS.skill + XP_AMOUNTS.mission);
    // The app does all of this in one handler: progress, ticks (so no mission key) and the ledger are reset together.
    act(() => {
      rerender({ done: new Set<string>(), keys: [] });
      result.current.reset();
    });
    expect(result.current.total).toBe(0);
    // If the ticks were NOT cleared, the mission key would come back and pay again: this is what clearTicks guards.
    rerender({ done: new Set<string>(), keys: [key] });
    expect(result.current.total).toBe(XP_AMOUNTS.mission);
  });

  it("records the step a skill was passed at, earns silver from a retest a level higher, and refuses a retest that is too soon", () => {
    const { result, rerender } = renderHook(({ done }) => useXp(tree, null, "off", done, []), { initialProps: { done: new Set<string>() } });
    // Like the app's pass handler: the step is recorded in the same update that ticks the skill.
    act(() => {
      result.current.recordPass("a", 2);
      rerender({ done: new Set(["a"]) });
    });
    expect(result.current.mastery).toEqual({ a: "bronze" });
    let outcome = "";
    act(() => void (outcome = result.current.retest("a", 4)));
    expect(outcome).toBe("tooSoon");
    act(() => void (outcome = result.current.retest("a", 6)));
    expect(outcome).toBe("silver");
    expect(result.current.mastery).toEqual({ a: "silver" });
    expect(result.current.total).toBe(XP_AMOUNTS.skill + XP_AMOUNTS.mastery.bronze + XP_AMOUNTS.mastery.silver);
  });

  it("gives a skill passed before mastery existed bronze at step 0, and removes the tiers when it is un-ticked", () => {
    const { result, rerender } = renderHook(({ done }) => useXp(tree, null, "off", done, []), { initialProps: { done: new Set(["a"]) } });
    expect(result.current.mastery).toEqual({ a: "bronze" });
    let outcome = "";
    act(() => void (outcome = result.current.retest("a", 4)));
    expect(outcome).toBe("silver");
    rerender({ done: new Set<string>() });
    expect(result.current.mastery).toEqual({});
    expect(result.current.total).toBe(0);
  });
});
