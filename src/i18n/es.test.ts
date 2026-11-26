import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "./en";
import { es } from "./es";
import { chooseLanguage, phoneLanguage } from "./index";

const BOTH = ["en", "es"] as const;

/** Every leaf of a language file, as [path, value] pairs. */
function leaves(node: object, path = ""): [string, unknown][] {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" ? leaves(value, `${path}${key}.`) : [[`${path}${key}`, value]],
  );
}

/** Text that is the same word in both languages, so it isn't a missed translation. */
const SAME_IN_BOTH = new Set(["tabs.brand", "tree.finalTile", "testMode.add"]);

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

  it("writes test times with a decimal comma", () => {
    expect(es.testMode.seconds(5.8)).toBe("5,8 s");
    expect(es.testMode.seconds(5.61)).toBe("5,61 s");
    expect(es.testMode.duration(7.5)).toBe("7,5 segundos");
    expect(es.testMode.duration(90.5)).toBe("1 min 30,5 s");
    expect(es.testMode.eachTry(2.5)).toMatch(/^Cada intento dura 2,5 segundos\./);
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
    expect(phoneLanguage(["es-MX", "en-US"], BOTH)).toBe("es");
    expect(phoneLanguage(["fr-FR", "es-ES", "en"], BOTH)).toBe("es");
    expect(phoneLanguage(["en-GB", "es"], BOTH)).toBe("en");
  });

  it("falls back to English", () => {
    expect(phoneLanguage(["fr-FR", "de"], BOTH)).toBe("en");
    expect(phoneLanguage([], BOTH)).toBe("en");
  });
});

describe("Spanish waits for a fluent check", () => {
  it("isn't picked from the phone yet, only from Settings", () => {
    expect(phoneLanguage(["es-MX", "en-US"])).toBe("en");
    expect(phoneLanguage(["es"])).toBe("en");
  });
});

describe("choosing a language", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports a blocked save and does not reload", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem: () => {},
    });
    const reload = vi.fn();
    expect(chooseLanguage("es", reload)).toBe("notSaved");
    expect(reload).not.toHaveBeenCalled();
  });

  it("saves and reloads", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const reload = vi.fn();
    expect(chooseLanguage("es", reload)).toBe("reloading");
    expect(reload).toHaveBeenCalledOnce();
    expect(chooseLanguage("es", reload)).toBe("unchanged");
  });
});
