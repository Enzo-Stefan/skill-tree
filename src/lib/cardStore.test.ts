// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanCard, loadCard, mergeCard, sameCard, storeCard } from "./cardStore";

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
});
