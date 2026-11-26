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

  it("lets the account's value win per field and fills gaps from this browser", () => {
    expect(mergeCard({ position: "GK", foot: null }, { position: "FWD", foot: "both" })).toEqual({ position: "GK", foot: "both" });
    expect(mergeCard({ position: null, foot: null }, { position: null, foot: null })).toEqual({ position: null, foot: null });
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
    expect(loadStored()).toEqual({ card: { position: "DEF", foot: null }, userId: "u1" });
    storeCard({ position: "DEF", foot: null });
    expect(loadStored().userId).toBeNull();
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "MID", foot: "left" }));
    expect(loadStored()).toEqual({ card: { position: "MID", foot: "left" }, userId: null });
    localStorage.setItem("skill-tree:card", JSON.stringify({ position: "MID", foot: null, userId: 5 }));
    expect(loadStored().userId).toBeNull();
  });

  describe("reconcileCard", () => {
    const none = { position: false, foot: false };
    const account = { position: "GK" as const, foot: null };
    const local = { position: "FWD" as const, foot: "both" as const };

    it("fills the account's gaps from a signed-out card or the same user's card", () => {
      expect(reconcileCard(account, local, null, "u1", none)).toEqual({ position: "GK", foot: "both" });
      expect(reconcileCard(account, local, "u1", "u1", none)).toEqual({ position: "GK", foot: "both" });
    });

    it("ignores another user's card", () => {
      expect(reconcileCard(account, local, "u2", "u1", none)).toEqual(account);
    });

    it("keeps fields the player changed meanwhile, even over the account's value", () => {
      expect(reconcileCard(account, local, "u2", "u1", { position: true, foot: false })).toEqual({ position: "FWD", foot: null });
    });
  });
});
