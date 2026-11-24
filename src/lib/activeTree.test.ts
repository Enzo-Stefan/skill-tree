import { beforeEach, describe, expect, it } from "vitest";
import { trees } from "../data";
import { football } from "../data/football";
import { weights } from "../data/weights";
import { activeTree, findTree, saveActiveTree, switchTree, treeSummaries } from "./activeTree";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

describe("the active tree", () => {
  it("is football the first time", () => {
    expect(activeTree(trees).id).toBe("football");
  });

  it("is remembered in the browser", () => {
    saveActiveTree("weights");
    expect(activeTree(trees).id).toBe("weights");
  });

  it("falls back to the first tree for an old or broken choice", () => {
    saveActiveTree("guitar");
    expect(activeTree(trees).id).toBe("football");
    expect(findTree(trees, null).id).toBe("football");
  });

  it("falls back to the first tree when storage is blocked", () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(activeTree(trees).id).toBe("football");
  });
});

describe("switching trees", () => {
  it("saves the choice and reloads", () => {
    let reloads = 0;
    expect(switchTree(trees, football, "weights", () => reloads++)).toBe(true);
    expect(activeTree(trees).id).toBe("weights");
    expect(reloads).toBe(1);
  });

  it("does nothing for the tree that's already open, or one that doesn't exist", () => {
    let reloads = 0;
    expect(switchTree(trees, football, "football", () => reloads++)).toBe(false);
    expect(switchTree(trees, football, "guitar", () => reloads++)).toBe(false);
    expect(reloads).toBe(0);
    expect(store.has("skill-tree:active-tree")).toBe(false);
  });
});

describe("tree summaries (for a picker)", () => {
  it("shows each tree's own progress and rank, and which one is open", () => {
    store.set("skill-tree:football", JSON.stringify(["root", "bc1", "bc2", "bc3", "ps1", "ps2", "gone"]));
    store.set("skill-tree:weights", JSON.stringify(["root", "lg1"]));
    const [f, w] = treeSummaries(trees, weights);
    expect(f).toMatchObject({ id: "football", shortName: "Football", done: 6, total: 32, rank: "Academy", active: false });
    expect(w).toMatchObject({ id: "weights", shortName: "Strength", done: 2, total: 22, rank: "Rookie", active: true });
  });

  it("starts every tree at zero", () => {
    expect(treeSummaries(trees, football).map((t) => t.done)).toEqual([0, 0]);
  });
});
