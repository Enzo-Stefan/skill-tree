import { describe, expect, it } from "vitest";
import { trees, translations, treesIn } from ".";
import { validateTree } from "../lib/progress";
import { translateTree, translationErrors } from "../lib/translate";
import type { Routine } from "../types";

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
    // A routine's numbers: everything except the words.
    const routineNumbers = (r: Routine | undefined) =>
      r && {
        sessionsPerWeek: r.sessionsPerWeek,
        minutes: r.minutes,
        heavy: r.heavy,
        exercises: r.exercises.map((e) => ({ sets: e.sets, reps: e.reps, seconds: e.seconds, restSeconds: e.restSeconds })),
      };
    const shape = (t: typeof tree) =>
      t.skills.map((s) => ({
        id: s.id,
        branch: s.branch,
        requires: s.requires,
        x: s.x,
        row: s.row,
        video: s.video,
        values: s.targets?.values,
        logWeight: s.logWeight,
        check: s.check,
        routine: routineNumbers(s.routine),
      }));
    expect(shape(translated)).toEqual(shape(tree));
    expect(translated.levels.map((l) => l.at)).toEqual(tree.levels.map((l) => l.at));
  });

  it("keeps every number from the English test", () => {
    const digits = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).sort();
    for (const s of tree.skills) expect(digits(tr.skills[s.id].test), s.id).toEqual(digits(s.test));
  });

  it("keeps every number written in the routine text: warm-up, cool-down, exercise names and how-tos", () => {
    const digits = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).sort();
    for (const s of tree.skills) {
      if (!s.routine) continue;
      const text = tr.skills[s.id].routine!;
      expect(digits(text.warmUp), `${s.id} warm-up`).toEqual(digits(s.routine.warmUp));
      expect(digits(text.coolDown), `${s.id} cool-down`).toEqual(digits(s.routine.coolDown));
      s.routine.exercises.forEach((e, i) => {
        expect(digits(text.exercises[i].name), `${s.id} exercise ${i + 1} name`).toEqual(digits(e.name));
        expect(digits(text.exercises[i].howTo), `${s.id} exercise ${i + 1} how-to`).toEqual(digits(e.howTo));
      });
    }
  });

  it("shows the routine in Spanish, with the English numbers", () => {
    const translated = translateTree(tree, tr);
    for (const s of translated.skills) {
      const original = tree.skills.find((o) => o.id === s.id)!;
      if (!original.routine) continue;
      expect(s.routine!.warmUp, `${s.id} warm-up`).not.toBe(original.routine.warmUp);
      s.routine!.exercises.forEach((e, i) => {
        expect(e.name, `${s.id} exercise ${i + 1}`).not.toBe(original.routine!.exercises[i].name);
        expect(e.sets).toEqual(original.routine!.exercises[i].sets);
      });
    }
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

describe("routine translations", () => {
  const tree = trees[0];
  const es = translations.es.football;

  it("catches a skill with a routine but no routine text", () => {
    const { routine: _dropped, ...rest } = es.skills.bc1;
    void _dropped;
    const broken = { ...es, skills: { ...es.skills, bc1: rest } };
    expect(translationErrors(tree, broken)).toContain("football: bc1 has a routine but no routine translation");
  });

  it("catches a different number of exercises and empty routine text", () => {
    const r = es.skills.bc1.routine!;
    const broken = {
      ...es,
      skills: { ...es.skills, bc1: { ...es.skills.bc1, routine: { warmUp: " ", coolDown: r.coolDown, exercises: [{ name: "", howTo: "x" }] } } },
    };
    const errors = translationErrors(tree, broken);
    expect(errors).toContain("football: bc1 routine warm-up is empty");
    expect(errors).toContain("football: bc1 routine has 1 exercises for 2 in the original");
    expect(errors).toContain("football: bc1 routine exercise 1 has no name");
  });

  it("keeps the English routine text where a translation has none, so a half-done language still works", () => {
    const { routine: _dropped, ...rest } = es.skills.bc1;
    void _dropped;
    const partial = { ...es, skills: { ...es.skills, bc1: rest } };
    const translated = translateTree(tree, partial);
    expect(translated.skills.find((s) => s.id === "bc1")!.routine).toEqual(tree.skills.find((s) => s.id === "bc1")!.routine);
  });
});
