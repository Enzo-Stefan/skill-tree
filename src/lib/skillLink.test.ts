import { describe, expect, it } from "vitest";
import type { Tree } from "../types";
import { skillFromSearch, skillUrl, withoutSkillParam } from "./skillLink";

const a = { id: "a", skills: [{ id: "ps3" }, { id: "x1" }] } as unknown as Tree;
const b = { id: "b", skills: [{ id: "sq1" }] } as unknown as Tree;

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
});

describe("skillUrl", () => {
  it("replaces other query and hash", () => {
    expect(skillUrl("https://h.dev/app/?a=1#tok", "ps3")).toBe("https://h.dev/app/?skill=ps3");
  });
});

describe("withoutSkillParam", () => {
  it("keeps the rest of the address", () => {
    expect(withoutSkillParam("https://h.dev/?skill=ps3&a=1#t")).toBe("https://h.dev/?a=1#t");
  });
});
