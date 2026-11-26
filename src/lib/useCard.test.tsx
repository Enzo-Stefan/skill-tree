// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { fetchCard, saveCard } from "./ratingHistory";
import { useCard } from "./useCard";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({})) }));
vi.mock("./ratingHistory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ratingHistory")>()),
  fetchCard: vi.fn(),
  saveCard: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchCard).mockReset().mockResolvedValue({ position: null, foot: null });
  vi.mocked(saveCard).mockReset().mockResolvedValue();
});
afterEach(cleanup);

describe("useCard", () => {
  it("keeps the choice in this browser when signed out, and calls nothing", () => {
    const { result } = renderHook(() => useCard(null, "off"));
    act(() => result.current.setCard({ position: "MID", foot: "left" }));
    expect(result.current.card).toEqual({ position: "MID", foot: "left" });
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual({ position: "MID", foot: "left" });
    expect(fetchCard).not.toHaveBeenCalled();
    expect(saveCard).not.toHaveBeenCalled();
  });

  it("waits for the account's progress before touching the account", () => {
    renderHook(() => useCard("u1", "loading"));
    expect(fetchCard).not.toHaveBeenCalled();
  });

  it("merges with the account once ready (account wins) and saves the result", async () => {
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "FWD", foot: "both" }));
    vi.mocked(fetchCard).mockResolvedValue({ position: "GK", foot: null });
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(result.current.card).toEqual({ position: "GK", foot: "both" }));
    expect(saveCard).toHaveBeenCalledWith(expect.anything(), "u1", { position: "GK", foot: "both" });
  });

  it("saves a later change to the account", async () => {
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(1));
    act(() => result.current.setCard({ position: "DEF", foot: "right" }));
    await waitFor(() => expect(saveCard).toHaveBeenLastCalledWith(expect.anything(), "u1", { position: "DEF", foot: "right" }));
  });

  it("keeps the choice in this browser when the account calls fail", async () => {
    vi.mocked(fetchCard).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalled());
    act(() => result.current.setCard({ position: "MID", foot: null }));
    expect(result.current.card).toEqual({ position: "MID", foot: null });
    expect(saveCard).not.toHaveBeenCalled();
  });
});
