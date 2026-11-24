import { describe, expect, it } from "vitest";
import { trees, translations, treesIn } from ".";
import { validateTree } from "../lib/progress";
import { translateTree, translationErrors } from "../lib/translate";

const pairs = Object.entries(translations).flatMap(([language, byTree]) =>
  trees.map((tree) => ({ language, tree, tr: byTree[tree.id] })),
);

describe.each(pairs)("$language $tree.id", ({ tree, tr }) => {
  it("translates everything, with no unknown ids", () => {
    expect(tr).toBeDefined();
    expect(translationErrors(tree, tr)).toEqual([]);
  });

  it("still passes the tree checker (names fit their tiles, targets keep their {n})", () => {
    expect(validateTree(translateTree(tree, tr))).toEqual([]);
  });

  it("changes only words: ids, unlock order, positions and numbers stay the same", () => {
    const translated = translateTree(tree, tr);
    const shape = (t: typeof tree) =>
      t.skills.map((s) => ({ id: s.id, branch: s.branch, requires: s.requires, x: s.x, row: s.row, video: s.video, values: s.targets?.values, logWeight: s.logWeight }));
    expect(shape(translated)).toEqual(shape(tree));
    expect(translated.levels.map((l) => l.at)).toEqual(tree.levels.map((l) => l.at));
  });

  it("keeps every number from the English test", () => {
    const digits = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).sort();
    for (const s of tree.skills) expect(digits(tr.skills[s.id].test), s.id).toEqual(digits(s.test));
  });
});

describe("picking a language", () => {
  it("shows Spanish for es and regional Spanish", () => {
    expect(treesIn("es")[0].branches[0].name).toBe("Control");
    expect(treesIn("es-MX")[1].shortName).toBe("Fuerza");
  });

  it("shows English for English and for languages we don't have", () => {
    expect(treesIn("en")).toEqual(trees);
    expect(treesIn("fr")).toEqual(trees);
  });

  it("falls back to English for anything a translation leaves out", () => {
    const tree = trees[0];
    const partial = { ...translations.es.football, skills: { root: translations.es.football.skills.root } };
    const translated = translateTree(tree, partial);
    expect(translated.skills[0].name).toBe("Primer control");
    expect(translated.skills[1].name).toBe(tree.skills[1].name);
    expect(translationErrors(tree, partial)).toContain("football: no translation for skill bc1");
  });

  it("catches a typo'd id and a lost {n}", () => {
    const tree = trees[0];
    const es = translations.es.football;
    const broken = {
      ...es,
      skills: { ...es.skills, bc9: es.skills.bc1, ft2: { ...es.skills.ft2, targetText: "En menos de segundos." } },
    };
    const errors = translationErrors(tree, broken);
    expect(errors).toContain("football: unknown skill bc9");
    expect(errors).toContain("football: ft2 targetText needs exactly one {n}");
  });
});
