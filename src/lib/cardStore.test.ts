// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanCard, loadCard, loadStored, mergeCard, reconcileCard, sameCard, storeCard } from "./cardStore";

beforeEach(() => localStorage.clear());

describe("card store", () => {
  it("keeps only values from the allowed lists", () => {
    expect(cleanCard({ position: "MID", foot: "left" })).toEqual({ position: "MID", foot: "left" });
    expect(cleanCard({ position: "STRIKER", foot: 3 })).toEqual({ position: null, foot: null });
    expect(cleanCard(null)).toEqual({ position: null, foot: null });
    expect(cleanCard("x")).toEqual({ position: null, foot: null });
  });

  const at = (position: number | null, foot: number | null) => ({ position, foot });
  const stamped = (position: "GK" | "FWD" | null, foot: "both" | null, a = at(null, null)) => ({ position, foot, at: a });

  it("lets the account's value win without stamps, and fills gaps from this browser", () => {
    expect(mergeCard(stamped("GK", null), stamped("FWD", "both"))).toEqual(stamped("GK", "both"));
    expect(mergeCard(stamped(null, null), stamped(null, null))).toEqual(stamped(null, null));
  });

  it("lets the later change win per field, including a change to none", () => {
    // Cleared in the account at 2000; this browser still holds the choice from 1000: it stays cleared.
    expect(mergeCard(stamped(null, null, at(2000, null)), stamped("FWD", null, at(1000, null)))).toEqual(stamped(null, null, at(2000, null)));
    // Cleared here at 3000, still set in the account from 2000: the clear wins.
    expect(mergeCard(stamped("GK", null, at(2000, null)), stamped(null, null, at(3000, null)))).toEqual(stamped(null, null, at(3000, null)));
    // A newer choice here beats an older one in the account.
    expect(mergeCard(stamped("GK", null, at(1000, null)), stamped("FWD", null, at(2000, null))).position).toBe("FWD");
  });

  it("compares cards by value", () => {
    expect(sameCard({ position: "GK", foot: null }, { position: "GK", foot: null })).toBe(true);
    expect(sameCard({ position: "GK", foot: null }, { position: "GK", foot: "left" })).toBe(false);
  });

  it("stores and loads, and survives broken storage", () => {
    storeCard({ position: "DEF", foot: "right" });
    expect(loadCard()).toEqual({ position: "DEF", foot: "right" });
    localStorage.setItem("skill-tree:card", "{not json");
    expect(loadCard()).toEqual({ position: null, foot: null });
  });

  it("remembers which account the card belongs to, and treats the old unstamped format as signed out", () => {
    storeCard({ position: "DEF", foot: null }, "u1");
    expect(loadStored()).toEqual({ card: { position: "DEF", foot: null }, at: at(null, null), userId: "u1" });
    storeCard({ position: "DEF", foot: null }, "u1", at(1000, 2000));
    expect(loadStored().at).toEqual(at(1000, 2000));
    storeCard({ position: "DEF", foot: null });
    expect(loadStored().userId).toBeNull();
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "MID", foot: "left" }));
    expect(loadStored()).toEqual({ card: { position: "MID", foot: "left" }, at: at(null, null), userId: null });
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "MID", foot: null, userId: 5 }));
    expect(loadStored().userId).toBeNull();
  });

  describe("reconcileCard", () => {
    const none = { position: false, foot: false };
    const account = stamped("GK", null);
    const local = stamped("FWD", "both");

    it("fills the account's gaps from a signed-out card or the same user's card", () => {
      expect(reconcileCard(account, local, null, "u1", none)).toEqual(stamped("GK", "both"));
      expect(reconcileCard(account, local, "u1", "u1", none)).toEqual(stamped("GK", "both"));
    });

    it("ignores another user's card", () => {
      expect(reconcileCard(account, local, "u2", "u1", none)).toEqual(account);
    });

    it("keeps fields the player changed meanwhile, even over the account's value", () => {
      expect(reconcileCard(account, local, "u2", "u1", { position: true, foot: false })).toEqual(stamped("FWD", null));
    });
  });
});
