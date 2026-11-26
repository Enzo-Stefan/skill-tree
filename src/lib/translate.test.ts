import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { translateTree, translationErrors, type TreeTranslation } from "./translate";

// The shipped translations are checked in src/data/translations.test.ts. These cover the rules themselves.
const skill = football.skills[0];
const tr: TreeTranslation = {
  title: "T",
  tagline: "tag",
  branches: Object.fromEntries(football.branches.map((b) => [b.id, `B-${b.id}`])),
  levels: football.levels.map((l) => `L-${l.at}`),
  skills: { [skill.id]: { name: "N", drill: "D", test: "T 1", tip: "P" } },
};

describe("translateTree", () => {
  it("returns the tree itself when there is no translation", () => {
    expect(translateTree(football, undefined)).toBe(football);
  });
  it("uses the translated words and keeps the structure", () => {
    const out = translateTree(football, tr);
    expect(out.title).toBe("T");
    expect(out.branches[0].name).toBe(`B-${football.branches[0].id}`);
    expect(out.levels.map((l) => l.at)).toEqual(football.levels.map((l) => l.at));
    expect(out.skills[0].name).toBe("N");
    expect(out.skills[0].requires).toEqual(skill.requires);
  });
  it("shows English for a skill the translation leaves out", () => {
    expect(translateTree(football, tr).skills[1]).toBe(football.skills[1]);
  });
});

describe("translationErrors", () => {
  it("names missing skills, unknown ids and empty text", () => {
    const errors = translationErrors(football, { ...tr, title: " ", skills: { ...tr.skills, nope: { name: "x", drill: "x", test: "x", tip: "x" } } });
    expect(errors).toContain(`${football.id}: title is empty`);
    expect(errors).toContain(`${football.id}: unknown skill nope`);
    expect(errors).toContain(`${football.id}: no translation for skill ${football.skills[1].id}`);
  });
  it("catches the wrong number of rank names", () => {
    expect(translationErrors(football, { ...tr, levels: ["only one"] }).some((e) => e.includes("rank names"))).toBe(true);
  });
});
