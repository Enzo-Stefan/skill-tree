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

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchXp).mockReset().mockResolvedValue([]);
  vi.mocked(pushXp).mockReset().mockResolvedValue();
});
afterEach(cleanup);

describe("useXp", () => {
  it("works out XP from the finished skills and training days, signed out", () => {
    const { result } = renderHook(() => useXp(tree, null, "off", new Set(["a"]), ["2026-11-25"]));
    expect(result.current.total).toBe(XP_AMOUNTS.skill + XP_AMOUNTS.session);
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
    expect(result.current.total).toBe(2 * XP_AMOUNTS.skill);
    rerender({ done: new Set(["a"]) });
    expect(result.current.total).toBe(XP_AMOUNTS.skill);
  });

  it("merges the account's ledger once progress is ready, without paying twice, and sends the result", async () => {
    const fromAccount: XpEvent[] = [
      { key: "skill:a:pass", xp: 100, active: true, at: T0 },
      { key: "streak:4", xp: 200, active: true, at: T0 },
    ];
    vi.mocked(fetchXp).mockResolvedValue(fromAccount);
    const { result } = renderHook(() => useXp(tree, "u1", "ready", new Set(["a", "b"]), []));
    await waitFor(() => expect(pushXp).toHaveBeenCalled());
    expect(result.current.total).toBe(2 * XP_AMOUNTS.skill + 200);
    const sent = vi.mocked(pushXp).mock.calls[0]![2];
    expect(sent.filter((e) => e.key === "skill:a:pass")).toHaveLength(1);
  });

  it("keeps working from this browser's copy when the account calls fail", async () => {
    vi.mocked(fetchXp).mockRejectedValue(new Error("relation xp_events does not exist"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useXp(tree, "u1", "ready", new Set(["a"]), []));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current.total).toBe(XP_AMOUNTS.skill);
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
    expect(result.current.total).toBe(XP_AMOUNTS.skill + XP_AMOUNTS.streak[4]!);
    rerender({ done: new Set<string>() });
    expect(result.current.earned).toContain("first-skill");
    // The skill's XP goes with the undo; the streak bonus stays, because the milestone was reached.
    expect(result.current.total).toBe(XP_AMOUNTS.streak[4]);
  });
});
