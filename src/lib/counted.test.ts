import { describe, expect, it } from "vitest";
import { mergeCounted, replayCounted } from "./counted";

const key = (s: string) => s;
const sorted = (l: string[]) => [...l].sort();

describe("mergeCounted (first sign-in)", () => {
  it("keeps entries from both lists", () => {
    expect(sorted(mergeCounted(["a"], ["b"], key))).toEqual(["a", "b"]);
  });
  it("counts an entry in both lists once (the same session synced earlier)", () => {
    expect(mergeCounted(["a"], ["a"], key)).toEqual(["a"]);
  });
  it("keeps two honest entries of the same key, taking the larger count", () => {
    expect(mergeCounted(["a", "a"], ["a"], key)).toEqual(["a", "a"]);
    expect(mergeCounted(["a"], ["a", "a", "a"], key)).toEqual(["a", "a", "a"]);
  });
  it("handles empty lists", () => {
    expect(mergeCounted([], [], key)).toEqual([]);
    expect(mergeCounted([], ["a"], key)).toEqual(["a"]);
  });
});

describe("replayCounted (changes made here, applied to the account's list)", () => {
  it("adds what was added here and keeps other devices' entries", () => {
    expect(sorted(replayCounted(["x"], ["x"], ["x", "a"], key))).toEqual(["a", "x"]);
  });
  it("removes what was removed here and keeps other devices' entries", () => {
    expect(sorted(replayCounted(["x", "a"], ["a", "x"], ["x"], key))).toEqual(["x"]);
    expect(sorted(replayCounted(["a", "y"], ["a"], [], key))).toEqual(["y"]);
  });
  it("changes nothing when nothing changed here", () => {
    expect(replayCounted(["x", "y"], ["a"], ["a"], key)).toEqual(["x", "y"]);
  });
  it("a second entry of the same key added here is added", () => {
    expect(replayCounted(["a"], ["a"], ["a", "a"], key)).toEqual(["a", "a"]);
  });
  it("doesn't double an entry whose save already reached the account", () => {
    expect(replayCounted(["a"], [], ["a"], key)).toEqual(["a"]);
  });
  it("doesn't remove below what the account already lost", () => {
    expect(replayCounted([], ["a"], [], key)).toEqual([]);
  });
  it("removing one of two copies here leaves one", () => {
    expect(replayCounted(["a", "a"], ["a", "a"], ["a"], key)).toEqual(["a"]);
  });
});
