import { describe, expect, it } from "vitest";
import { trees, translations, treesIn } from ".";
import { validateTree } from "../lib/progress";
import { translateTree, translationErrors } from "../lib/translate";
import type { Routine } from "../types";

// The numbers in a text, each with the unit of measure that follows it ("10 m", "5 min", "70 %"). Counting
// words ("reps", "times") aren't units: a translation may add one where the English leaves it implied. Number words count
// too, so "every fifth touch" becoming "cada cuatro toques" is caught. "one", "two", "first" and "second" are
// left out: they double as articles ("un balón"), "both" ("los dos pies") and a unit of time.
const NUMBER_WORDS: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30,
  tercer: 3, tercero: 3, tercera: 3, cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6,
  séptimo: 7, séptima: 7, octavo: 8, octava: 8, noveno: 9, novena: 9, décimo: 10, décima: 10,
};
// English "once" means one time, not eleven.
const ENGLISH_ONLY_SKIP = new Set(["once"]);
const UNITS: Record<string, string> = {
  m: "m", metre: "m", metres: "m", meter: "m", meters: "m", metro: "m", metros: "m",
  km: "km", kilometre: "km", kilometres: "km", kilómetro: "km", kilómetros: "km",
  second: "s", seconds: "s", segundo: "s", segundos: "s",
  minute: "min", minutes: "min", minuto: "min", minutos: "min",
  hour: "h", hours: "h", hora: "h", horas: "h",
  "%": "%",
  week: "weeks", weeks: "weeks", semana: "weeks", semanas: "weeks",
};
export const quantities = (text: string, language: "en" | "es") => {
  const tokens = text.toLowerCase().match(/\p{L}+|\d+(?:\.\d+)?|%/gu) ?? [];
  const found: string[] = [];
  tokens.forEach((token, i) => {
    const skip = language === "en" && ENGLISH_ONLY_SKIP.has(token);
    const value = /^\d/.test(token) ? token : skip ? undefined : NUMBER_WORDS[token]?.toString();
    if (value === undefined) return;
    const unit = UNITS[tokens[i + 1] ?? ""];
    found.push(unit ? `${value} ${unit}` : value);
  });
  return found.sort();
};

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

  it("keeps every number and unit from the English test", () => {
    for (const s of tree.skills) expect(quantities(tr.skills[s.id].test, "es"), s.id).toEqual(quantities(s.test, "en"));
  });

  it("keeps every number and unit written in the routine text: warm-up, cool-down, exercise names and how-tos", () => {
    const same = (es: string, en: string, where: string) => expect(quantities(es, "es"), where).toEqual(quantities(en, "en"));
    for (const s of tree.skills) {
      if (!s.routine) continue;
      const text = tr.skills[s.id].routine!;
      same(text.warmUp, s.routine.warmUp, `${s.id} warm-up`);
      same(text.coolDown, s.routine.coolDown, `${s.id} cool-down`);
      s.routine.exercises.forEach((e, i) => {
        same(text.exercises[i].name, e.name, `${s.id} exercise ${i + 1} name`);
        same(text.exercises[i].howTo, e.howTo, `${s.id} exercise ${i + 1} how-to`);
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

describe("the number check", () => {
  it("matches a number written as a word in either language", () => {
    expect(quantities("cada cinco toques", "es")).toEqual(quantities("every fifth touch", "en"));
  });

  it("catches a number word that changed", () => {
    expect(quantities("cada cuatro toques", "es")).not.toEqual(quantities("every fifth touch", "en"));
  });

  it("catches a changed unit, and allows a different spelling of the same one", () => {
    expect(quantities("Esprinta 10 segundos", "es")).not.toEqual(quantities("Sprint 10 m", "en"));
    expect(quantities("90 minutos, al 70 %", "es")).toEqual(quantities("a 90-minute game at 70%", "en"));
    expect(quantities("10 metros", "es")).toEqual(quantities("10 m", "en"));
  });

  it("ignores words that only look like numbers: articles, 'both', 'once'", () => {
    expect(quantities("un balón con los dos pies", "es")).toEqual(quantities("a ball with both feet once", "en"));
  });
});
