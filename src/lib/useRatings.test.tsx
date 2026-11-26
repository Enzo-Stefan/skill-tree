// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { football } from "../data/football";
import { fetchSnapshots, pushSnapshots } from "./ratingHistory";
import { useRatings } from "./useRatings";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({})) }));
vi.mock("./ratingHistory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ratingHistory")>()),
  fetchSnapshots: vi.fn(),
  pushSnapshots: vi.fn(),
}));

const beginner = football.playerLevels![0]!.id;
const bc = football.skills.filter((s) => s.branch === "bc").map((s) => s.id);

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchSnapshots).mockReset().mockResolvedValue([]);
  vi.mocked(pushSnapshots).mockReset().mockResolvedValue();
});
afterEach(cleanup);

describe("useRatings", () => {
  it("works out the ratings and records this week's snapshot, signed out", () => {
    const { result } = renderHook(() => useRatings(football, null, "off", new Set(bc.slice(0, 3)), beginner, 1, "2026-11-26"));
    expect(result.current.ratings.branches.bc).toBe(30);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({ week: "2026-11-23", overall: 5 });
    expect(fetchSnapshots).not.toHaveBeenCalled();
  });

  it("records nothing while the account's progress is still loading", () => {
    const { result } = renderHook(() => useRatings(football, "u1", "loading", new Set(bc), beginner, 1, "2026-11-26"));
    expect(result.current.history).toEqual([]);
  });

  it("changes the same week's snapshot when progress changes, and does not add a second one", () => {
    const { result, rerender } = renderHook(({ n }) => useRatings(football, null, "off", new Set(bc.slice(0, n)), beginner, 1, "2026-11-26"), { initialProps: { n: 1 } });
    rerender({ n: 4 });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]!.overall).toBe(result.current.ratings.overall);
  });

  it("merges the account's history once progress is ready and sends it", async () => {
    vi.mocked(fetchSnapshots).mockResolvedValue([{ week: "2026-11-16", ratings: { bc: 10 }, overall: 2, at: "2026-11-20T10:00:00.000Z" }]);
    const { result } = renderHook(() => useRatings(football, "u1", "ready", new Set(bc), beginner, 3, "2026-11-26"));
    await waitFor(() => expect(pushSnapshots).toHaveBeenCalled());
    await waitFor(() => expect(result.current.history.map((s) => s.week)).toEqual(["2026-11-16", "2026-11-23"]));
    expect(vi.mocked(pushSnapshots).mock.calls[0]![2]).toHaveLength(2);
  });

  it("keeps working from this browser's copy when the account calls fail", async () => {
    vi.mocked(fetchSnapshots).mockRejectedValue(new Error("relation does not exist"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useRatings(football, "u1", "ready", new Set(bc), beginner, 1, "2026-11-26"));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current.history).toHaveLength(1);
    expect(pushSnapshots).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
