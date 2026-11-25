// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import type { LeaderboardProfile } from "../types";
import { fetchProfile, saveProfile } from "./leaderboardApi";
import { useLeaderboardProfile } from "./useLeaderboardProfile";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({})) }));
vi.mock("./leaderboardApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./leaderboardApi")>()),
  fetchProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

const profile: LeaderboardProfile = { displayName: "Sam", countryCode: "AL", hemisphere: null, leaderboardOptIn: true };

beforeEach(() => vi.mocked(fetchProfile).mockReset().mockRejectedValueOnce(new Error("offline")));
afterEach(() => {
  cleanup();
  vi.mocked(saveProfile).mockReset();
});

describe("useLeaderboardProfile", () => {
  it("reports the error and refuses to save when loading fails", async () => {
    const { result } = renderHook(() => useLeaderboardProfile("u1"));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(await result.current.save(profile)).toBe("failed");
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("retry reloads the profile and clears the error", async () => {
    vi.mocked(fetchProfile).mockResolvedValueOnce(profile);
    const { result } = renderHook(() => useLeaderboardProfile("u1"));
    await waitFor(() => expect(result.current.error).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.profile).toEqual(profile));
    expect(result.current.error).toBe(false);
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });
});
