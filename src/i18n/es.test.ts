import { describe, expect, it } from "vitest";
import { en } from "./en";
import { es } from "./es";
import { phoneLanguage } from "./index";

/** Every leaf of a language file, as [path, value] pairs. */
function leaves(node: object, path = ""): [string, unknown][] {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" ? leaves(value, `${path}${key}.`) : [[`${path}${key}`, value]],
  );
}

/** Text that is the same word in both languages, so it isn't a missed translation. */
const SAME_IN_BOTH = new Set(["tabs.brand", "tree.finalTile"]);

describe("Spanish language file", () => {
  it("has every piece of text English has, and nothing empty", () => {
    const enPaths = leaves(en).map(([path]) => path);
    const esLeaves = leaves(es);
    expect(esLeaves.map(([path]) => path)).toEqual(enPaths);
    for (const [path, value] of esLeaves) {
      if (typeof value === "string") expect(value.trim(), path).not.toBe("");
      else expect(typeof value, path).toBe("function");
    }
  });

  it("has no text left in English", () => {
    const english = new Map(leaves(en));
    for (const [path, value] of leaves(es)) {
      if (typeof value === "string" && !SAME_IN_BOTH.has(path)) expect(value, path).not.toBe(english.get(path));
    }
  });

  it("puts names and numbers where Spanish needs them", () => {
    expect(es.header.moreToReach(6, "Academia")).toBe("6 más para llegar a Academia");
    expect(es.practice.weeks(1)).toBe("1 semana");
    expect(es.practice.weeks(3)).toBe("3 semanas");
    expect(es.tree.after(["Pase con la pierna mala"])).toBe("Después de Pase con la pierna mala");
    expect(es.tree.after(["A", "B"])).toBe("Después de A y B");
    expect(es.tree.after(["a", "b", "c"])).toBe("Después de 3 habilidades más");
    expect(es.share.imageTraining("Principiante 2", es.share.imageStreak(1))).toBe(
      "Entrenando en Principiante 2 · racha de 1 semana",
    );
    expect(es.lifts.timesLogged(1)).toBe("1 registro");
    expect(es.lifts.upFrom("20 kg", 2)).toBe("Antes: 20 kg · 2 registros");
  });

  it("writes dates the Spanish way", () => {
    const year = new Date().getFullYear();
    expect(es.lifts.on(`${year}-11-03`)).toBe("3 nov");
    expect(es.lifts.on("2019-11-03")).toBe("3 nov 2019");
  });

  it("searches YouTube with Spanish words for each tree", () => {
    expect(es.panel.youtubeSearch("football", "Toques")).toBe("Toques fútbol ejercicio tutorial");
    expect(es.panel.youtubeSearch("weights", "Sentadilla goblet")).toBe("Sentadilla goblet técnica ejercicio tutorial");
  });
});

describe("phone language", () => {
  it("picks the first language the app has", () => {
    expect(phoneLanguage(["es-MX", "en-US"])).toBe("es");
    expect(phoneLanguage(["fr-FR", "es-ES", "en"])).toBe("es");
    expect(phoneLanguage(["en-GB", "es"])).toBe("en");
  });

  it("falls back to English", () => {
    expect(phoneLanguage(["fr-FR", "de"])).toBe("en");
    expect(phoneLanguage([])).toBe("en");
  });
});
