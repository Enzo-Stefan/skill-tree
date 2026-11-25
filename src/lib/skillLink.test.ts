import { describe, expect, it } from "vitest";
import type { Tree } from "../types";
import { skillFromSearch, skillUrl, withoutSkillParam } from "./skillLink";

const a = { id: "a", skills: [{ id: "ps3" }, { id: "x1" }, { id: "root" }] } as unknown as Tree;
const b = { id: "b", skills: [{ id: "sq1" }, { id: "root" }] } as unknown as Tree;

describe("skillFromSearch", () => {
  it("finds the tree that has the skill", () => {
    expect(skillFromSearch([a, b], "?skill=sq1")).toEqual({ tree: b, skillId: "sq1" });
    expect(skillFromSearch([a, b], "?x=1&skill=ps3")?.tree).toBe(a);
  });
  it("ignores a missing or unknown skill", () => {
    expect(skillFromSearch([a, b], "")).toBeNull();
    expect(skillFromSearch([a, b], "?skill=nope")).toBeNull();
    expect(skillFromSearch([a, b], "?skill=")).toBeNull();
  });
  it("uses ?tree= to pick the tree when a skill id is in several trees", () => {
    expect(skillFromSearch([a, b], "?skill=root")?.tree).toBe(a);
    expect(skillFromSearch([a, b], "?tree=b&skill=root")).toEqual({ tree: b, skillId: "root" });
    expect(skillFromSearch([a, b], "?skill=root&tree=b")?.tree).toBe(b);
  });
  it("falls back to searching by skill id when ?tree= is unknown or lacks the skill", () => {
    expect(skillFromSearch([a, b], "?tree=nope&skill=root")?.tree).toBe(a);
    expect(skillFromSearch([a, b], "?tree=b&skill=ps3")?.tree).toBe(a);
    expect(skillFromSearch([a, b], "?tree=nope&skill=nope")).toBeNull();
  });
});

describe("skillUrl", () => {
  it("replaces other query and hash", () => {
    expect(skillUrl("https://h.dev/app/?a=1#tok", "ps3")).toBe("https://h.dev/app/?skill=ps3");
  });
  it("adds the tree before the skill when a tree id is given", () => {
    expect(skillUrl("https://h.dev/app/?a=1#tok", "root", "b")).toBe("https://h.dev/app/?tree=b&skill=root");
  });
  it("round-trips through skillFromSearch", () => {
    const url = new URL(skillUrl("https://h.dev/", "root", "b"));
    expect(skillFromSearch([a, b], url.search)?.tree).toBe(b);
  });
});

describe("withoutSkillParam", () => {
  it("keeps the rest of the address", () => {
    expect(withoutSkillParam("https://h.dev/?skill=ps3&a=1#t")).toBe("https://h.dev/?a=1#t");
  });
  it("removes both tree and skill", () => {
    expect(withoutSkillParam("https://h.dev/?tree=b&skill=root&a=1#t")).toBe("https://h.dev/?a=1#t");
    expect(withoutSkillParam("https://h.dev/?tree=b&skill=root")).toBe("https://h.dev/");
  });
});
