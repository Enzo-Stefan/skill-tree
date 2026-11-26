import { describe, expect, it } from "vitest";
import { CHALLENGES } from "../challenges";
import { SEASONS } from "../seasons";
import { quantities } from "../translations.test";
import { challengeWords, seasonTitle } from "../../lib/challengeText";
import { challengesEs, seasonTitlesEs } from "./challenges";

const english = [
  ...CHALLENGES.map((c) => ({ id: c.id, title: c.title, text: c.text })),
  ...SEASONS.flatMap((s) => s.challenges.map((c) => ({ id: c.id, title: c.title, text: c.text }))),
];

describe("Spanish challenges", () => {
  it("has words for every challenge and no id the app doesn't have", () => {
    expect(Object.keys(challengesEs).sort()).toEqual(english.map((c) => c.id).sort());
  });
  it("has no empty or English text", () => {
    for (const c of english) {
      const es = challengesEs[c.id]!;
      expect(es.title.trim(), c.id).not.toBe("");
      expect(es.text.trim(), c.id).not.toBe("");
      expect(es.title, c.id).not.toBe(c.title);
      expect(es.text, c.id).not.toBe(c.text);
    }
  });
  it("keeps every number the English text has", () => {
    for (const c of english) expect(quantities(challengesEs[c.id]!.text, "es"), c.id).toEqual(quantities(c.text, "en"));
  });
  it("has a title for every season", () => {
    expect(Object.keys(seasonTitlesEs).sort()).toEqual(SEASONS.map((s) => s.id).sort());
  });
});

describe("challengeWords and seasonTitle", () => {
  const en = { title: "Show up", text: "Train today." };
  it("uses the language's words, else the English", () => {
    expect(challengeWords("d-train", en, "es").title).toBe("Presente");
    expect(challengeWords("d-train", en, "en")).toEqual(en);
    expect(challengeWords("nope", en, "es")).toEqual(en);
    expect(seasonTitle("winter-2026", "Winter Grind", "es")).toBe("Invierno de trabajo");
    expect(seasonTitle("winter-2026", "Winter Grind", "en")).toBe("Winter Grind");
  });
});
