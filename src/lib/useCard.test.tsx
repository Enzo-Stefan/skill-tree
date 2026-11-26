// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { fetchCard, saveCard, type CardStamps, type PlayerCard, type StampedCard } from "./ratingHistory";
import { useCard } from "./useCard";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({})) }));
vi.mock("./ratingHistory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ratingHistory")>()),
  fetchCard: vi.fn(),
  saveCard: vi.fn(),
}));

const acct = (card: PlayerCard, at: CardStamps = { position: null, foot: null }): StampedCard => ({ ...card, at });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchCard).mockReset().mockResolvedValue(acct({ position: null, foot: null }));
  vi.mocked(saveCard).mockReset().mockResolvedValue();
});
afterEach(cleanup);

describe("useCard", () => {
  it("keeps the choice in this browser when signed out, and calls nothing", () => {
    const { result } = renderHook(() => useCard(null, "off"));
    act(() => result.current.setCard({ position: "MID", foot: "left" }));
    expect(result.current.card).toEqual({ position: "MID", foot: "left" });
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual(expect.objectContaining({ position: "MID", foot: "left", userId: null }));
    expect(fetchCard).not.toHaveBeenCalled();
    expect(saveCard).not.toHaveBeenCalled();
  });

  it("waits for the account's progress before touching the account", () => {
    renderHook(() => useCard("u1", "loading"));
    expect(fetchCard).not.toHaveBeenCalled();
  });

  it("merges with the account once ready (account wins) and saves the result", async () => {
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "FWD", foot: "both" }));
    vi.mocked(fetchCard).mockResolvedValue(acct({ position: "GK", foot: null }));
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(result.current.card).toEqual({ position: "GK", foot: "both" }));
    expect(saveCard).toHaveBeenCalledWith(expect.anything(), "u1", { position: "GK", foot: "both" }, expect.anything());
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual(expect.objectContaining({ position: "GK", foot: "both", userId: "u1" }));
  });

  it("does not give account B the card account A left in this browser", async () => {
    const a = renderHook(() => useCard("uA", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalledTimes(1));
    act(() => a.result.current.setCard({ position: "FWD", foot: "left" }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(1));
    a.unmount();
    vi.mocked(saveCard).mockClear();
    vi.mocked(fetchCard).mockResolvedValue(acct({ position: "GK", foot: null }));
    const b = renderHook(() => useCard("uB", "ready"));
    await waitFor(() => expect(b.result.current.card).toEqual({ position: "GK", foot: null }));
    expect(saveCard).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("skill-tree:card")!)).toEqual(expect.objectContaining({ position: "GK", foot: null, userId: "uB" }));
  });

  it("keeps the user's own card across reloads and sign-ins", async () => {
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "DEF", foot: "right", userId: "u1" }));
    const { result } = renderHook(() => useCard("u1", "ready"));
    expect(result.current.card).toEqual({ position: "DEF", foot: "right" });
    await waitFor(() => expect(saveCard).toHaveBeenCalledWith(expect.anything(), "u1", { position: "DEF", foot: "right" }, expect.anything()));
    expect(result.current.card).toEqual({ position: "DEF", foot: "right" });
  });

  it("does not save on sign-in when the account already has the merged card", async () => {
    vi.mocked(fetchCard).mockResolvedValue(acct({ position: "GK", foot: "left" }));
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(result.current.card).toEqual({ position: "GK", foot: "left" }));
    expect(saveCard).not.toHaveBeenCalled();
  });

  it("keeps a pick made while the first fetch is pending", async () => {
    let release: (c: StampedCard) => void = () => undefined;
    vi.mocked(fetchCard).mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalled());
    act(() => result.current.setCard({ position: "MID", foot: null }));
    await act(async () => release(acct({ position: "GK", foot: null })));
    await waitFor(() => expect(saveCard).toHaveBeenCalledWith(expect.anything(), "u1", { position: "MID", foot: null }, expect.anything()));
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
    expect(saveCard).toHaveBeenLastCalledWith(expect.anything(), "u1", { position: "DEF", foot: "right" }, expect.anything());
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

  it("syncs again on the next change after the first fetch failed, so the change is saved", async () => {
    vi.mocked(fetchCard).mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    act(() => result.current.setCard({ position: "MID", foot: null }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveCard).mock.calls[0][2]).toEqual({ position: "MID", foot: null });
  });

  it("keeps a field cleared on this device cleared when another device still holds the old choice", async () => {
    const { result } = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(fetchCard).toHaveBeenCalledTimes(1));
    act(() => result.current.setCard({ position: "DEF", foot: "right" }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(1));
    act(() => result.current.setCard({ position: null, foot: "right" }));
    await waitFor(() => expect(saveCard).toHaveBeenCalledTimes(2));
    const [, , card, at] = vi.mocked(saveCard).mock.calls[1];
    expect(card).toEqual({ position: null, foot: "right" });
    expect(at?.position).toBeGreaterThan(0);

    // Another device signs in holding the old choice with an older stamp; the account's newer "none" wins.
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "DEF", foot: "right", userId: "u1", at: { position: 1000, foot: 1000 } }));
    vi.mocked(fetchCard).mockResolvedValue(acct({ position: null, foot: "right" }, { position: 2000, foot: 1000 }));
    vi.mocked(saveCard).mockClear();
    const other = renderHook(() => useCard("u1", "ready"));
    await waitFor(() => expect(other.result.current.card).toEqual({ position: null, foot: "right" }));
    expect(saveCard).not.toHaveBeenCalled();
  });
});
