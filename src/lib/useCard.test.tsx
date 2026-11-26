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
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual({ position: "MID", foot: "left", userId: null });
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
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual({ position: "GK", foot: "both", userId: "u1" });
  });

  it("does not give account B the card account A left in this browser", async () => {
    const a = renderHook(() => useCard("uA", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalledTimes(1));
    act(() => a.result.current.setCard({ position: "FWD", foot: "left" }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(1));
    a.unmount();
    vi.mocked(saveCard).mockClear();
    vi.mocked(fetchCard).mockResolvedValue({ position: "GK", foot: null });
    const b = renderHook(() => useCard("uB", "ready"));
    await waitFor(() => expect(b.result.current.card).toEqual({ position: "GK", foot: null }));
    expect(saveCard).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual({ position: "GK", foot: null, userId: "uB" });
  });

  it("keeps the user's own card across reloads and sign-ins", async () => {
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "DEF", foot: "right", userId: "u1" }));
    const { result } = renderHook(() => useCard("u1", "ready"));
    expect(result.current.card).toEqual({ position: "DEF", foot: "right" });
    await waitFor(() => expect(saveCard).toHaveBeenCalledWith(expect.anything(), "u1", { position: "DEF", foot: "right" }));
    expect(result.current.card).toEqual({ position: "DEF", foot: "right" });
  });

  it("does not save on sign-in when the account already has the merged card", async () => {
    vi.mocked(fetchCard).mockResolvedValue({ position: "GK", foot: "left" });
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(result.current.card).toEqual({ position: "GK", foot: "left" }));
    expect(saveCard).not.toHaveBeenCalled();
  });

  it("keeps a pick made while the first fetch is pending", async () => {
    let release: (c: { position: "GK" | null; foot: null }) => void = () => undefined;
    vi.mocked(fetchCard).mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalled());
    act(() => result.current.setCard({ position: "MID", foot: null }));
    await act(async () => release({ position: "GK", foot: null }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledWith(expect.anything(), "u1", { position: "MID", foot: null }));
    expect(result.current.card).toEqual({ position: "MID", foot: null });
  });

  it("saves quick changes one after another, in order", async () => {
    const order: string[] = [];
    let first: () => void = () => undefined;
    vi.mocked(saveCard).mockImplementation(async (_c, _u, card) => {
      order.push(`start ${card.position}`);
      if (card.position === "DEF") await new Promise<void>((r) => (first = r));
      order.push(`end ${card.position}`);
    });
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalled());
    act(() => result.current.setCard({ position: "DEF", foot: null }));
    await waitFor(() => expect(order).toEqual(["start DEF"]));
    act(() => result.current.setCard({ position: "FWD", foot: null }));
    await new Promise((r) => setTimeout(r, 20));
    expect(order).toEqual(["start DEF"]);
    first();
    await waitFor(() => expect(order).toEqual(["start DEF", "end DEF", "start FWD", "end FWD"]));
  });

  it("saves a later change to the account", async () => {
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalledTimes(1));
    act(() => result.current.setCard({ position: "DEF", foot: "right" }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(1));
    expect(saveCard).toHaveBeenLastCalledWith(expect.anything(), "u1", { position: "DEF", foot: "right" });
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
